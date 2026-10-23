import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../../../database/enums.js';
import { CreateOrderItemDto } from '../../dto/create-order-staff.dto.js';
import {
  BACKDATED_MAX_ITEMS_PER_ORDER,
  BACKDATED_MAX_ORDERS,
} from '../backdated-orders.constants.js';

export class BackdatedOrderDto {
  @IsUUID()
  tableId: string;

  /** `HH:mm` shop time; defaults to midday. */
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BACKDATED_MAX_ITEMS_PER_ORDER)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class CreateBackdatedOrdersDto {
  /** Shop day, `YYYY-MM-DD`. */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BACKDATED_MAX_ORDERS)
  @ValidateNested({ each: true })
  @Type(() => BackdatedOrderDto)
  orders: BackdatedOrderDto[];
}
