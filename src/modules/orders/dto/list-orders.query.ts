import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '../../../database/enums.js';

export class ListOrdersQuery {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
