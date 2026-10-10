import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StaffSchedule } from '../../database/entities/staff-schedule.entity.js'
import { StaffShiftRegistration } from '../../database/entities/staff-shift-registration.entity.js'
import type { CreateStaffScheduleDto, UpdateStaffScheduleDto } from './dto/staff-schedules.dto.js'

@Injectable()
export class StaffSchedulesService {
  constructor(
    @InjectRepository(StaffSchedule) private readonly schedules: Repository<StaffSchedule>,
    @InjectRepository(StaffShiftRegistration) private readonly registrations: Repository<StaffShiftRegistration>,
  ) {}

  async createSchedules(branchId: string, dto: CreateStaffScheduleDto): Promise<StaffSchedule[]> {
    const created: StaffSchedule[] = []

    for (const shift of dto.shifts) {
      const schedule = this.schedules.create({
        branchId,
        weekStartDate: dto.weekStartDate,
        dayOfWeek: shift.dayOfWeek,
        startTime: shift.startTime,
        endTime: shift.endTime,
        shiftType: shift.shiftType,
        position: shift.position,
        status: 'scheduled',
      })
      created.push(await this.schedules.save(schedule))
    }

    return created
  }

  async listSchedulesByWeek(branchId: string, weekStartDate: string): Promise<StaffSchedule[]> {
    return this.schedules.find({
      where: { branchId, weekStartDate },
      relations: { assignedToUser: true, registrations: { staffUser: true } },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    })
  }

  async getSchedule(branchId: string, scheduleId: string): Promise<StaffSchedule> {
    const schedule = await this.schedules.findOne({
      where: { id: scheduleId, branchId },
      relations: { assignedToUser: true, registrations: { staffUser: true } },
    })
    if (!schedule) throw new NotFoundException('Schedule not found')
    return schedule
  }

  async updateSchedule(
    branchId: string,
    scheduleId: string,
    dto: UpdateStaffScheduleDto,
  ): Promise<StaffSchedule> {
    const schedule = await this.getSchedule(branchId, scheduleId)

    if (dto.startTime !== undefined) schedule.startTime = dto.startTime
    if (dto.endTime !== undefined) schedule.endTime = dto.endTime
    if (dto.shiftType !== undefined) schedule.shiftType = dto.shiftType
    if (dto.position !== undefined) schedule.position = dto.position
    if (dto.status !== undefined) schedule.status = dto.status
    if (dto.assignedToUserId !== undefined) schedule.assignedToUserId = dto.assignedToUserId

    return this.schedules.save(schedule)
  }

  async cancelSchedule(branchId: string, scheduleId: string): Promise<StaffSchedule> {
    const schedule = await this.getSchedule(branchId, scheduleId)
    schedule.status = 'cancelled'
    return this.schedules.save(schedule)
  }

  async registerForShift(branchId: string, scheduleId: string, staffUserId: string): Promise<StaffShiftRegistration> {
    const schedule = await this.getSchedule(branchId, scheduleId)

    if (schedule.status !== 'scheduled') {
      throw new BadRequestException('Cannot register for cancelled or unavailable shift')
    }

    const existing = await this.registrations.findOne({
      where: { scheduleId, staffUserId },
    })

    if (existing) {
      throw new BadRequestException('Already registered for this shift')
    }

    const registration = this.registrations.create({
      scheduleId,
      staffUserId,
      status: 'pending',
    })

    return this.registrations.save(registration)
  }

  async approveRegistration(branchId: string, registrationId: string, adminUserId: string): Promise<StaffShiftRegistration> {
    const registration = await this.registrations.findOne({
      where: { id: registrationId },
      relations: { schedule: true },
    })

    if (!registration) throw new NotFoundException('Registration not found')
    if (registration.schedule.branchId !== branchId) throw new BadRequestException('Schedule not in user branch')

    registration.status = 'approved'
    registration.reviewedAt = new Date()
    registration.reviewedByUserId = adminUserId
    registration.schedule.assignedToUserId = registration.staffUserId

    await this.schedules.save(registration.schedule)
    return this.registrations.save(registration)
  }

  async rejectRegistration(
    branchId: string,
    registrationId: string,
    adminUserId: string,
    notes?: string,
  ): Promise<StaffShiftRegistration> {
    const registration = await this.registrations.findOne({
      where: { id: registrationId },
      relations: { schedule: true },
    })

    if (!registration) throw new NotFoundException('Registration not found')
    if (registration.schedule.branchId !== branchId) throw new BadRequestException('Schedule not in user branch')

    registration.status = 'rejected'
    registration.reviewedAt = new Date()
    registration.reviewedByUserId = adminUserId
    registration.adminNotes = notes || null

    return this.registrations.save(registration)
  }

  async listRegistrationsByWeek(branchId: string, weekStartDate: string): Promise<StaffShiftRegistration[]> {
    return this.registrations
      .createQueryBuilder('reg')
      .innerJoinAndSelect('reg.schedule', 'schedule', 'schedule.branchId = :branchId AND schedule.weekStartDate = :weekStartDate', {
        branchId,
        weekStartDate,
      })
      .innerJoinAndSelect('reg.staffUser', 'staffUser')
      .orderBy('schedule.dayOfWeek', 'ASC')
      .addOrderBy('schedule.startTime', 'ASC')
      .addOrderBy('reg.createdAt', 'ASC')
      .getMany()
  }

  async getStaffRegistrations(branchId: string, staffUserId: string, weekStartDate: string): Promise<StaffShiftRegistration[]> {
    return this.registrations
      .createQueryBuilder('reg')
      .innerJoinAndSelect('reg.schedule', 'schedule', 'schedule.branchId = :branchId AND schedule.weekStartDate = :weekStartDate', {
        branchId,
        weekStartDate,
      })
      .where('reg.staffUserId = :staffUserId', { staffUserId })
      .orderBy('schedule.dayOfWeek', 'ASC')
      .addOrderBy('schedule.startTime', 'ASC')
      .getMany()
  }
}
