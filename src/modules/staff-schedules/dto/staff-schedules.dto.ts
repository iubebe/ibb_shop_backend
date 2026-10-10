import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_SHIFTS_PER_REQUEST = 50

export class ShiftInputDto {
  /** 1=Monday, 7=Sunday */
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number

  /** HH:mm */
  @Matches(TIME_PATTERN, { message: 'startTime must be HH:mm' })
  startTime: string

  /** HH:mm */
  @Matches(TIME_PATTERN, { message: 'endTime must be HH:mm' })
  endTime: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  shiftType?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string
}

export class CreateStaffScheduleDto {
  @IsDateString()
  weekStartDate: string // YYYY-MM-DD (Monday)

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SHIFTS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => ShiftInputDto)
  shifts: ShiftInputDto[]
}

/** Staff proposal: same shape as the admin create, stored as `proposed` until an admin approves. */
export class ProposeStaffShiftsDto extends CreateStaffScheduleDto {}

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

export class ReviewProposalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string
}
