import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StaffSchedule } from '../../database/entities/staff-schedule.entity.js'
import { StaffShiftRegistration } from '../../database/entities/staff-shift-registration.entity.js'
import { StaffSchedulesController } from './staff-schedules.controller.js'
import { StaffSchedulesService } from './staff-schedules.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([StaffSchedule, StaffShiftRegistration])],
  controllers: [StaffSchedulesController],
  providers: [StaffSchedulesService],
})
export class StaffSchedulesModule {}
