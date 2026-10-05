import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceReportService } from './attendance-report.service.js';
import { AttendanceService } from './attendance.service.js';
import { FaceQueueService } from './face-queue.service.js';
import { ShopCalendar } from './shop-calendar.js';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceRecord])],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    AttendanceReportService,
    FaceQueueService,
    ShopCalendar,
  ],
})
export class AttendanceModule {}
