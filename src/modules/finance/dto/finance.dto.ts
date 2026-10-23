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
  MinLength,
} from 'class-validator';
import { ExpenseCategory, InvestmentCategory } from '../../../database/enums.js';

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

export class CreateInvestmentDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsEnum(InvestmentCategory)
  category: InvestmentCategory;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(MAX_AMOUNT)
  amount: number;

  @Matches(DAY, { message: DAY_MESSAGE })
  investedOn: string;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

export class UpdateInvestmentDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(InvestmentCategory)
  category?: InvestmentCategory;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(MAX_AMOUNT)
  amount?: number;

  @IsOptional()
  @Matches(DAY, { message: DAY_MESSAGE })
  investedOn?: string;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(200)
  note?: string | null;
}
