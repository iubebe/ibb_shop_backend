import { RedisThrottlerStorage } from '../redis-throttler.storage.js';

function setup() {
  const client = { eval: vi.fn() };
  const logger = { setContext: vi.fn(), error: vi.fn() };
  const storage = new RedisThrottlerStorage(
    { client } as never,
    logger as never,
  );
  return { storage, client, logger };
}

describe('RedisThrottlerStorage', () => {
  it('maps the Lua result and converts ms to seconds', async () => {
    const { storage, client } = setup();
    client.eval.mockResolvedValue([3, 1500, 0, 0]);
    expect(await storage.increment('k', 60000, 10, 0, 'default')).toEqual({
      totalHits: 3,
      timeToExpire: 2,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    const args = client.eval.mock.calls[0] ?? [];
    expect(args.slice(2)).toEqual([
      'throttle:k',
      'throttle:block:k',
      '60000',
      '10',
      '0',
    ]);
  });

  it('reports a block', async () => {
    const { storage, client } = setup();
    client.eval.mockResolvedValue([11, 40000, 1, 60000]);
    expect(await storage.increment('k', 60000, 10, 60000, 'default')).toEqual({
      totalHits: 11,
      timeToExpire: 40,
      isBlocked: true,
      timeToBlockExpire: 60,
    });
  });

  it('fails open and logs when Redis is down', async () => {
    const { storage, client, logger } = setup();
    client.eval.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await storage.increment('k', 1000, 1, 0, 'default');
    expect(res.isBlocked).toBe(false);
    expect(res.totalHits).toBe(0);
    expect(logger.error).toHaveBeenCalled();
  });
});
