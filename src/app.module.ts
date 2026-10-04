import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health/health.controller.js';
import { EventsGateway } from './events/events.gateway.js';
import { LoggerModule } from './logger/logger.module.js';
import { VersionModule } from './version/version.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    RedisModule,
    VersionModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, EventsGateway],
})
export class AppModule {}
