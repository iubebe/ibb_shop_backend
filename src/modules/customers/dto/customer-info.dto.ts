import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { normalizePhone } from '../customer-info.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Optional customer fields shared by create-order, edit-order and customer edit. `null` or blank clears. */
export class CustomerInfoDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  customerName?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePhone(value) || null : value,
  )
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'customerPhone must be a valid phone number' })
  customerPhone?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  customerAddress?: string | null;
}
