import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { normalizePhone } from '../customer-info.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Fields left out stay as they are; `null` or blank clears one. */
export class UpdateCustomerDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  name?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePhone(value) || null : value,
  )
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'phone must be a valid phone number' })
  phone?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  address?: string | null;
}
