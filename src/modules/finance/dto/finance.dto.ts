import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ExpenseCategory } from '../../../database/enums.js';

/** Blank optional text becomes `null` (clears the field on update). */
const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** Calendar day, validated for real in the service. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'must be a date in YYYY-MM-DD format';

const MAX_AMOUNT = 9_999_999_999;

/** `[from, to)` as calendar days (`YYYY-MM-DD`) in the shop timezone. */
export class RangeQuery {
  @Matches(DAY, { message: DAY_MESSAGE })
  from: string;

  @Matches(DAY, { message: DAY_MESSAGE })
  to: string;
}

export class CreateExpenseDto {
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(MAX_AMOUNT)
  amount: number;

  @Matches(DAY, { message: DAY_MESSAGE })
  incurredOn: string;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(MAX_AMOUNT)
  amount?: number;

  @IsOptional()
  @Matches(DAY, { message: DAY_MESSAGE })
  incurredOn?: string;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(200)
  note?: string | null;
}
