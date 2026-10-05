import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
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
