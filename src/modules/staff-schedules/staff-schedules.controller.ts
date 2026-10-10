import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import type { AuthUser } from '../../auth/auth.types.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { Roles } from '../../auth/decorators/roles.decorator.js'
import { UserRole } from '../../database/enums.js'
import {
  ApproveRegistrationDto,
  CreateStaffScheduleDto,
  ProposeStaffShiftsDto,
  ReviewProposalDto,
  UpdateStaffScheduleDto,
} from './dto/staff-schedules.dto.js'
import { StaffSchedulesService, type ScheduleViewer } from './staff-schedules.service.js'

function viewerOf(user: AuthUser): ScheduleViewer {
  return { id: user.id, isAdmin: user.role === UserRole.ADMIN }
}

@Controller('staff-schedules')
export class StaffSchedulesController {
  constructor(private readonly schedules: StaffSchedulesService) {}

  /** Admin: Create shifts for a week */
  @Roles(UserRole.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffScheduleDto) {
    return this.schedules.createSchedules(user.branchId, dto)
  }

  /** Admin/Staff: List schedules for a week */
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get()
  listByWeek(
    @CurrentUser() user: AuthUser,
    @Query('weekStartDate') weekStartDate: string,
  ) {
    return this.schedules.listSchedulesByWeek(user.branchId, weekStartDate, viewerOf(user))
  }

  /** Get a specific schedule */
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get(':scheduleId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ) {
    return this.schedules.getSchedule(user.branchId, scheduleId, viewerOf(user))
  }

  /** Staff: propose one or more shifts. They stay `proposed` until an admin approves them. */
  @Roles(UserRole.STAFF)
  @Post('proposals')
  propose(@CurrentUser() user: AuthUser, @Body() dto: ProposeStaffShiftsDto) {
    return this.schedules.proposeShifts(user.branchId, user.id, dto)
  }

  /** Admin: every proposal in the week (any review state) */
  @Roles(UserRole.ADMIN)
  @Get('proposals/by-week/:weekStartDate')
  listProposals(@CurrentUser() user: AuthUser, @Param('weekStartDate') weekStartDate: string) {
    return this.schedules.listProposalsByWeek(user.branchId, weekStartDate)
  }

  /** Staff: their own proposals for the week */
  @Roles(UserRole.STAFF)
  @Get('proposals/mine/:weekStartDate')
  myProposals(@CurrentUser() user: AuthUser, @Param('weekStartDate') weekStartDate: string) {
    return this.schedules.listMyProposals(user.branchId, user.id, weekStartDate)
  }

  /** Admin: approve a proposal. It becomes an open shift (`scheduled`). */
  @Roles(UserRole.ADMIN)
  @Post('proposals/:scheduleId/approve')
  approveProposal(
    @CurrentUser() user: AuthUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: ReviewProposalDto,
  ) {
    return this.schedules.approveProposal(user.branchId, scheduleId, user.id, dto.notes)
  }

  /** Admin: reject a proposal. Staff can still see it, with the notes. */
  @Roles(UserRole.ADMIN)
  @Post('proposals/:scheduleId/reject')
  rejectProposal(
    @CurrentUser() user: AuthUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: ReviewProposalDto,
  ) {
    return this.schedules.rejectProposal(user.branchId, scheduleId, user.id, dto.notes)
  }

  /** Admin: Update a schedule */
  @Roles(UserRole.ADMIN)
  @Put(':scheduleId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: UpdateStaffScheduleDto,
  ) {
    return this.schedules.updateSchedule(user.branchId, scheduleId, dto)
  }

  /** Admin: Cancel a schedule */
  @Roles(UserRole.ADMIN)
  @Post(':scheduleId/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ) {
    return this.schedules.cancelSchedule(user.branchId, scheduleId)
  }

  /** Staff: Register for a shift */
  @Roles(UserRole.STAFF)
  @Post(':scheduleId/register')
  register(
    @CurrentUser() user: AuthUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ) {
    return this.schedules.registerForShift(user.branchId, scheduleId, user.id)
  }

  /** Admin: List all registrations for a week */
  @Roles(UserRole.ADMIN)
  @Get('registrations/by-week/:weekStartDate')
  listRegistrations(
    @CurrentUser() user: AuthUser,
    @Param('weekStartDate') weekStartDate: string,
  ) {
    return this.schedules.listRegistrationsByWeek(user.branchId, weekStartDate)
  }

  /** Staff: View their registrations for a week */
  @Roles(UserRole.STAFF)
  @Get('my-registrations/:weekStartDate')
  myRegistrations(
    @CurrentUser() user: AuthUser,
    @Param('weekStartDate') weekStartDate: string,
  ) {
    return this.schedules.getStaffRegistrations(user.branchId, user.id, weekStartDate)
  }

  /** Admin: Approve a registration */
  @Roles(UserRole.ADMIN)
  @Post('registrations/:registrationId/approve')
  approveRegistration(
    @CurrentUser() user: AuthUser,
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Body() dto: ApproveRegistrationDto,
  ) {
    return this.schedules.approveRegistration(user.branchId, registrationId, user.id)
  }

  /** Admin: Reject a registration */
  @Roles(UserRole.ADMIN)
  @Post('registrations/:registrationId/reject')
  rejectRegistration(
    @CurrentUser() user: AuthUser,
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Body() dto: ApproveRegistrationDto,
  ) {
    return this.schedules.rejectRegistration(user.branchId, registrationId, user.id, dto.notes)
  }
}
