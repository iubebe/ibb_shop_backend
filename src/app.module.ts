import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health/health.controller.js';
import { EventsGateway } from './events/events.gateway.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), RedisModule],
  controllers: [AppController, HealthController],
  providers: [AppService, EventsGateway],
})
export class AppModule {}
