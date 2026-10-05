import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health/health.controller.js';
import { EventsGateway } from './events/events.gateway.js';
import { LoggerModule } from './logger/logger.module.js';
import { VersionModule } from './version/version.module.js';
import { RedisModule } from './redis/redis.module.js';
import { S3Module } from './s3/s3.module.js';
import { ThrottleModule } from './throttle/throttle.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { GuestModule } from './modules/guest/guest.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    DatabaseModule,
    RedisModule,
    S3Module,
    ThrottleModule,
    AuthModule,
    GuestModule,
    OrdersModule,
    CategoriesModule,
    DashboardModule,
    ProductsModule,
    UsersModule,
    AttendanceModule,
    VersionModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, EventsGateway],
})
export class AppModule {}
