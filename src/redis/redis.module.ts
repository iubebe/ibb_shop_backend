import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisService } from './redis.service.js';

/**
 * Global Redis module. Import once in AppModule, then inject `RedisService`
 * (or the raw ioredis client via `@Inject(REDIS_CLIENT)`) anywhere.
 *
 * Env: REDIS_HOST (localhost), REDIS_PORT (6379), REDIS_PASSWORD, REDIS_DB (0)
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          db: config.get<number>('REDIS_DB', 0),
        }),
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
