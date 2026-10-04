import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import { REDIS_CLIENT } from '../redis.constants.js';
import { RedisModule } from '../redis.module.js';
import { RedisService } from '../redis.service.js';

const { RedisMock } = vi.hoisted(() => {
  const ctor = vi.fn();
  class RedisMock {
    on = vi.fn();
    quit = vi.fn().mockResolvedValue('OK');
    constructor(options: unknown) {
      ctor(options);
    }
  }
  return { RedisMock: Object.assign(RedisMock, { ctor }) };
});

vi.mock('ioredis', () => ({ Redis: RedisMock }));

async function build(env: Record<string, unknown>) {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => env],
      }),
      LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
      RedisModule,
    ],
  }).compile();
}

describe('RedisModule', () => {
  beforeEach(() => RedisMock.ctor.mockClear());

  it('creates the client from config', async () => {
    const moduleRef = await build({
      REDIS_HOST: 'redis',
      REDIS_PORT: 6380,
      REDIS_PASSWORD: 'secret',
      REDIS_DB: 2,
    });

    expect(RedisMock.ctor).toHaveBeenCalledWith({
      host: 'redis',
      port: 6380,
      password: 'secret',
      db: 2,
    });
    expect(moduleRef.get(REDIS_CLIENT)).toBeDefined();
    await moduleRef.close();
  });

  it('falls back to defaults and omits an empty password', async () => {
    const moduleRef = await build({ REDIS_PASSWORD: '' });

    expect(RedisMock.ctor).toHaveBeenCalledWith({
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: 0,
    });
    await moduleRef.close();
  });

  it('exports RedisService', async () => {
    const moduleRef = await build({});
    expect(moduleRef.get(RedisService)).toBeInstanceOf(RedisService);
    await moduleRef.close();
  });
});
