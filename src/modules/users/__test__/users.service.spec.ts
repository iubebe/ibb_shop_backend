import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../../database/enums.js';
import { UsersService } from '../users.service.js';

const staff = () => ({
  id: 'u2',
  branchId: 'b1',
  name: 'Staff',
  email: 'staff@x.io',
  role: UserRole.STAFF,
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date(0),
});

function build(opts: { found?: object | null; clash?: object | null; history?: number } = {}) {
  const found = opts.found === undefined ? staff() : opts.found;
  const qb = {
    where: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(opts.clash ?? null),
  };
  const repo = {
    find: vi.fn().mockResolvedValue([staff()]),
    findOneBy: vi.fn().mockResolvedValue(found),
    createQueryBuilder: vi.fn(() => qb),
    create: vi.fn((v: object) => v),
    save: vi.fn((v: object) => Promise.resolve({ id: 'new', createdAt: new Date(0), ...v })),
    remove: vi.fn().mockResolvedValue(undefined),
    manager: { countBy: vi.fn().mockResolvedValue(opts.history ?? 0) },
  };
  const passwords = { hash: vi.fn().mockResolvedValue('hashed') };
  const sessions = { revokeAllForUser: vi.fn().mockResolvedValue(undefined) };
  return {
    service: new UsersService(repo as never, passwords as never, sessions as never),
    repo,
    passwords,
    sessions,
  };
}

describe('UsersService', () => {
  describe('create', () => {
    it('hashes the password and forces a change at first login', async () => {
      const { service, repo } = build();
      const res = await service.create('b1', {
        name: 'New',
        email: 'new@x.io',
        role: UserRole.CASHIER,
        password: 'long-enough-pass',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'b1',
          passwordHash: 'hashed',
          mustChangePassword: true,
          isActive: true,
        }),
      );
      expect(res).not.toHaveProperty('passwordHash');
    });

    it('rejects short passwords and duplicate emails without saving', async () => {
      const { service, repo } = build({ clash: { id: 'other' } });
      const dto = { name: 'N', email: 'a@x.io', role: UserRole.STAFF, password: 'long-enough-pass' };
      await expect(service.create('b1', { ...dto, password: 'short' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.create('b1', dto)).rejects.toBeInstanceOf(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('ends sessions when the role changes or the account is disabled', async () => {
      const a = build();
      await a.service.update('b1', 'admin', 'u2', { role: UserRole.CASHIER });
      expect(a.sessions.revokeAllForUser).toHaveBeenCalledWith('u2');

      const b = build();
      await b.service.update('b1', 'admin', 'u2', { isActive: false });
      expect(b.sessions.revokeAllForUser).toHaveBeenCalledWith('u2');
    });

    it('keeps sessions for a plain rename', async () => {
      const { service, sessions } = build();
      await service.update('b1', 'admin', 'u2', { name: 'Renamed' });
      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('stops admins from demoting or disabling themselves', async () => {
      const { service, repo } = build({ found: { ...staff(), id: 'admin', role: UserRole.ADMIN } });
      await expect(
        service.update('b1', 'admin', 'admin', { role: UserRole.STAFF }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.update('b1', 'admin', 'admin', { isActive: false }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows renaming yourself and keeping your own email', async () => {
      const { service } = build({ found: { ...staff(), id: 'admin' }, clash: { id: 'admin' } });
      await expect(
        service.update('b1', 'admin', 'admin', { name: 'Me', email: 'staff@x.io' }),
      ).resolves.toMatchObject({ name: 'Me' });
    });

    it('409s when the new email belongs to someone else', async () => {
      const { service } = build({ clash: { id: 'other' } });
      await expect(
        service.update('b1', 'admin', 'u2', { email: 'taken@x.io' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('404s for a user outside the branch', async () => {
      const { service } = build({ found: null });
      await expect(service.update('b1', 'admin', 'u2', {})).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resetPassword', () => {
    it('sets a temporary password and ends the sessions', async () => {
      const { service, repo, sessions } = build();
      await service.resetPassword('b1', 'admin', 'u2', 'another-long-pass');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'hashed', mustChangePassword: true }),
      );
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u2');
    });

    it('refuses your own account and weak passwords', async () => {
      const { service } = build();
      await expect(
        service.resetPassword('b1', 'u2', 'u2', 'another-long-pass'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.resetPassword('b1', 'admin', 'u2', 'short')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('deletes an account without history', async () => {
      const { service, repo, sessions } = build();
      await service.remove('b1', 'admin', 'u2');
      expect(repo.remove).toHaveBeenCalled();
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u2');
    });

    it('409s when the account has check-in history', async () => {
      const { service, repo } = build({ history: 3 });
      await expect(service.remove('b1', 'admin', 'u2')).rejects.toBeInstanceOf(ConflictException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('refuses to delete yourself', async () => {
      const { service } = build();
      await expect(service.remove('b1', 'u2', 'u2')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
