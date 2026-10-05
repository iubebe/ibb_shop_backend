import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { MONTH_PATTERN } from '../attendance.constants.js';
import type { PhotoKind } from '../attendance.types.js';

const MONTH_MESSAGE = 'month must look like 2026-10';

export class MonthQuery {
  @Matches(MONTH_PATTERN, { message: MONTH_MESSAGE })
  month: string;
}

export class ListAttendanceQuery extends MonthQuery {
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class UpdateAttendanceDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  checkInAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  checkOutAt?: Date;
}

export class PhotoParams {
  @IsUUID()
  id: string;

  @IsIn(['check-in', 'check-out'])
  kind: PhotoKind;
}
