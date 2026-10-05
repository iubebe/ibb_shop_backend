import { IsEnum } from 'class-validator';
import { PaymentMethod } from '../../../database/enums.js';

export class PayOrderDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
