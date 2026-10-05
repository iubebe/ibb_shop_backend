import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../../database/enums.js';
import { AttendanceService } from '../attendance.service.js';

const user = {
  id: 'u1',
  role: UserRole.STAFF,
  branchId: 'b1',
  sessionId: 's1',
  mustChangePassword: false,
};
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const record = (over: object = {}) => ({
  id: 'r1',
  userId: 'u1',
  checkInAt: new Date(Date.now() - 3_600_000),
  checkOutAt: null,
  checkOutPhotoKey: null,
  checkInFaceStatus: 'pending',
  checkOutFaceStatus: 'pending',
  adjustedAt: null,
  ...over,
});

function build(opts: { open?: object | null } = {}) {
  const manager = {
    findOne: vi.fn(async (entity: { name: string }) => {
      if (entity.name === 'User') return { id: 'u1' };
      return opts.open ?? null;
    }),
    create: vi.fn((_e: unknown, v: object) => v),
    save: vi.fn(async (v: object) => ({ ...record(), ...v })),
  };
  const repo = { manager, findOne: vi.fn(), findOneBy: vi.fn(), save: vi.fn(async (v: object) => v), find: vi.fn() };
  const dataSource = { transaction: vi.fn((fn: (m: unknown) => unknown) => fn(manager)) };
  const s3 = { upload: vi.fn().mockResolvedValue({}), delete: vi.fn().mockResolvedValue(undefined), download: vi.fn() };
  const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const logger = { setContext: vi.fn(), warn: vi.fn() };
  const service = new AttendanceService(
    repo as never,
    dataSource as never,
    s3 as never,
    queue as never,
    {} as never,
    {} as never,
    logger as never,
  );
  return { service, repo, manager, s3, queue };
}

describe('AttendanceService', () => {
  describe('checkIn', () => {
    it('stores the photo, creates the record and queues a face check', async () => {
      const { service, s3, manager, queue } = build();
      const res = await service.checkIn(user, jpeg);
      expect(s3.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^attendance\/b1\/u1\/.+-in\.jpg$/),
        jpeg,
        { contentType: 'image/jpeg' },
      );
      expect(manager.save).toHaveBeenCalled();
      expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'check-in', userId: 'u1' }));
      expect(res.status).toBe('open');
    });

    it('409s before uploading when a session is already open', async () => {
      const { service, s3 } = build({ open: record() });
      await expect(service.checkIn(user, jpeg)).rejects.toBeInstanceOf(ConflictException);
      expect(s3.upload).not.toHaveBeenCalled();
    });

    it('removes the photo when it loses a race inside the transaction', async () => {
      const { service, s3, queue, manager } = build();
      // pre-check sees no open session; the locked re-check sees the winner's
      const findOpen = vi.fn().mockResolvedValueOnce(null).mockResolvedValue(record());
      manager.findOne.mockImplementation(async (entity: { name: string }) =>
        entity.name === 'User' ? { id: 'u1' } : findOpen(),
      );
      await expect(service.checkIn(user, jpeg)).rejects.toBeInstanceOf(ConflictException);
      expect(s3.upload).toHaveBeenCalledTimes(1);
      expect(s3.delete).toHaveBeenCalledWith(s3.upload.mock.calls[0][0]);
      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('rejects a non-JPEG upload before touching storage', async () => {
      const { service, s3 } = build();
      await expect(service.checkIn(user, Buffer.from('nope'))).rejects.toBeInstanceOf(BadRequestException);
      expect(s3.upload).not.toHaveBeenCalled();
    });
  });

  describe('checkOut', () => {
    it('closes the open session with a second photo', async () => {
      const { service, s3, manager, queue } = build({ open: record() });
      const res = await service.checkOut(user, jpeg);
      expect(s3.upload).toHaveBeenCalledWith(expect.stringMatching(/r1-out\.jpg$/), jpeg, expect.anything());
      expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ checkOutAt: expect.any(Date) }));
      expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'check-out', recordId: 'r1' }));
      expect(res.status).toBe('completed');
      expect(res.minutes).toBeGreaterThanOrEqual(59);
    });

    it('409s when there is no open session', async () => {
      const { service, s3 } = build();
      await expect(service.checkOut(user, jpeg)).rejects.toBeInstanceOf(ConflictException);
      expect(s3.upload).not.toHaveBeenCalled();
    });
  });

  describe('adjust', () => {
    const patch = (found: object | null, change: { checkInAt?: Date; checkOutAt?: Date }) => {
      const ctx = build();
      ctx.repo.findOne.mockResolvedValue(found);
      return { ...ctx, run: () => ctx.service.adjust('b1', 'admin', 'r1', change) };
    };
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

    it('closes a forgotten session and records who did it', async () => {
      const { run, repo } = patch(record({ checkInAt: hoursAgo(30) }), {
        checkOutAt: hoursAgo(22),
      });
      const res = await run();
      expect(res.minutes).toBe(480);
      expect(res.adjusted).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ adjustedByUserId: 'admin' }));
    });

    it('validates order, future times and the 24h cap', async () => {
      const base = record({ checkInAt: hoursAgo(10) });
      await expect(patch(base, { checkOutAt: hoursAgo(11) }).run()).rejects.toBeInstanceOf(BadRequestException);
      await expect(patch(base, { checkOutAt: new Date(Date.now() + 3_600_000) }).run()).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        patch(base, { checkInAt: hoursAgo(40), checkOutAt: hoursAgo(1) }).run(),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s for a record outside the branch', async () => {
      await expect(patch(null, { checkOutAt: new Date() }).run()).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('photo', () => {
    it('404s when the record has no photo of that kind', async () => {
      const { service, repo } = build();
      repo.findOneBy.mockResolvedValue(record());
      await expect(service.photo('b1', 'r1', 'check-out')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
