import { IsArray, IsDateString, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class ShiftInputDto {
  dayOfWeek: number // 1=Monday, 7=Sunday
  startTime: string // HH:mm
  endTime: string   // HH:mm
  @IsOptional()
  shiftType?: string
  @IsOptional()
  position?: string
}

export class CreateStaffScheduleDto {
  @IsDateString()
  weekStartDate: string // YYYY-MM-DD (Monday)

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiftInputDto)
  shifts: ShiftInputDto[]
}

export class UpdateStaffScheduleDto {
  @IsOptional()
  @IsString()
  startTime?: string

  @IsOptional()
  @IsString()
  endTime?: string

  @IsOptional()
  @IsString()
  shiftType?: string

  @IsOptional()
  @IsString()
  position?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string | null
}

export class ApproveRegistrationDto {
  @IsOptional()
  @IsString()
  notes?: string
}
