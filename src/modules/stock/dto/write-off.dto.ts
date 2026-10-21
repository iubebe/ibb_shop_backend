import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { WriteOffCause } from '../../../database/enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const MAX_QTY = 99_999_999;

export class CreateWriteOffDto {
  @IsUUID()
  stockItemId: string;

  /** Positive amount to remove from stock. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(MAX_QTY)
  quantity: number;

  @IsEnum(WriteOffCause)
  cause: WriteOffCause;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class ConfirmWriteOffDto {
  /** Admin may correct the proposed amount. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(MAX_QTY)
  quantity?: number;
}

export class RejectWriteOffDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason: string;
}

export class ListWriteOffsQuery {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}
