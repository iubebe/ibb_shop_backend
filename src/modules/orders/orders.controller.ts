import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import { CreateOrderStaffDto } from './dto/create-order-staff.dto.js';
import { ListOrdersQuery } from './dto/list-orders.query.js';
import { UpdateServedDto } from './dto/update-served.dto.js';
import { OrdersService } from './orders.service.js';

@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CASHIER)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** e.g. `GET /api/orders?status=confirmed` for the serving queue. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListOrdersQuery) {
    return this.orders.list(user.branchId, query.status);
  }

  /** Create an order for a table with items (staff/admin only). */
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderStaffDto) {
    return this.orders.createOrder(user.branchId, user.id, dto);
  }

  /** Staff marks how many units were delivered to the table. */
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':orderId/items/:itemId/served')
  setServed(
    @CurrentUser() user: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateServedDto,
  ) {
    return this.orders.setServed(
      user.branchId,
      orderId,
      itemId,
      dto.servedQuantity,
    );
  }
}
