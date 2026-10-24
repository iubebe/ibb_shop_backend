import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

/** The order number is the first characters of the order id, as printed on the receipt (`Số`). */
export class OrderSearchQuery {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/^#/, '') : value))
  @Matches(/^[0-9a-fA-F]{3,8}$/, { message: 'code must be 3 to 8 hex characters' })
  code: string;
}
