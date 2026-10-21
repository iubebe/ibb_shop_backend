import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { normalizePhone } from '../customer-info.js';

export class LookupCustomerQuery {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePhone(value) : value,
  )
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'phone must be a valid phone number' })
  phone: string;
}
