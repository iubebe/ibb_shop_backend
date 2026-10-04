import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisService } from './redis.service.js';

describe('RedisService', () => {
  let service: RedisService;
  let client: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    ping: ReturnType<typeof vi.fn>;
    quit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  };

  let logger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    logger = { info: vi.fn(), error: vi.fn(), setContext: vi.fn() };
    client = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn(),
      ping: vi.fn(),
      quit: vi.fn().mockResolvedValue('OK'),
      on: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: REDIS_CLIENT, useValue: client as unknown as Redis },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = moduleRef.get(RedisService);
  });

  it('registers error and ready listeners', () => {
    const events = client.on.mock.calls.map(([event]) => event);
    expect(events).toEqual(expect.arrayContaining(['error', 'ready']));
  });

  it('sets the logger context', () => {
    expect(logger.setContext).toHaveBeenCalledWith('RedisService');
  });

  it('logs redis errors and readiness through pino', () => {
    const handler = (event: string) =>
      client.on.mock.calls.find(([e]) => e === event)![1] as (
        e?: Error,
      ) => void;

    const err = new Error('boom');
    handler('error')(err);
    handler('ready')();

    expect(logger.error).toHaveBeenCalledWith({ err }, 'Redis error');
    expect(logger.info).toHaveBeenCalledWith('Redis connected');
  });

  describe('get', () => {
    it('returns the stored value', async () => {
      client.get.mockResolvedValue('v');
      await expect(service.get('k')).resolves.toBe('v');
      expect(client.get).toHaveBeenCalledWith('k');
    });

    it('returns null for a missing key', async () => {
      client.get.mockResolvedValue(null);
      await expect(service.get('missing')).resolves.toBeNull();
    });
  });

  describe('set', () => {
    it('sets without expiry when no ttl is given', async () => {
      await service.set('k', 'v');
      expect(client.set).toHaveBeenCalledWith('k', 'v');
    });

    it('sets with EX when ttl is given', async () => {
      await service.set('k', 'v', 60);
      expect(client.set).toHaveBeenCalledWith('k', 'v', 'EX', 60);
    });
  });

  describe('del', () => {
    it('deletes multiple keys and returns the count', async () => {
      client.del.mockResolvedValue(2);
      await expect(service.del('a', 'b')).resolves.toBe(2);
      expect(client.del).toHaveBeenCalledWith('a', 'b');
    });
  });

  describe('json helpers', () => {
    it('getJson parses the stored value', async () => {
      client.get.mockResolvedValue('{"a":1}');
      await expect(service.getJson<{ a: number }>('k')).resolves.toEqual({
        a: 1,
      });
    });

    it('getJson returns null for a missing key', async () => {
      client.get.mockResolvedValue(null);
      await expect(service.getJson('k')).resolves.toBeNull();
    });

    it('setJson serializes the value and forwards the ttl', async () => {
      await service.setJson('k', { a: 1 }, 30);
      expect(client.set).toHaveBeenCalledWith('k', '{"a":1}', 'EX', 30);
    });
  });

  describe('ping', () => {
    it('is true on PONG', async () => {
      client.ping.mockResolvedValue('PONG');
      await expect(service.ping()).resolves.toBe(true);
    });

    it('is false on any other reply', async () => {
      client.ping.mockResolvedValue('nope');
      await expect(service.ping()).resolves.toBe(false);
    });
  });

  it('quits the connection on module destroy', async () => {
    await service.onModuleDestroy();
    expect(client.quit).toHaveBeenCalledOnce();
  });
});
