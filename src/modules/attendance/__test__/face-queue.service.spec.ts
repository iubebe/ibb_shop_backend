import { REDIS_KEY } from '../../../constants/redis-key.constants.js';
import { FaceQueueService } from '../face-queue.service.js';

const job = { recordId: 'r1', userId: 'u1', kind: 'check-in' as const, photoKey: 'k' };

describe('FaceQueueService', () => {
  it('pushes a JSON job onto the face queue list', async () => {
    const lpush = vi.fn().mockResolvedValue(1);
    const service = new FaceQueueService({ client: { lpush } } as never, { setContext: vi.fn(), warn: vi.fn() } as never);
    await service.enqueue(job);
    const [key, payload] = lpush.mock.calls[0];
    expect(key).toBe(REDIS_KEY.ATTENDANCE_FACE_QUEUE);
    expect(JSON.parse(payload)).toMatchObject({ ...job, enqueuedAt: expect.any(String) });
  });

  it('swallows Redis errors so a check-in is never blocked', async () => {
    const warn = vi.fn();
    const lpush = vi.fn().mockRejectedValue(new Error('down'));
    const service = new FaceQueueService({ client: { lpush } } as never, { setContext: vi.fn(), warn } as never);
    await expect(service.enqueue(job)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
