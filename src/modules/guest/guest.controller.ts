import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { GuestService } from './guest.service.js';

/**
 * Public endpoints for the guest web. The table's `qrToken` (from the QR
 * code URL) is the only credential; it scopes everything to one table.
 * Unsafe methods still need the CSRF token (`GET /api/auth/csrf`).
 */
@Public()
@Controller('guest/tables/:qrToken')
export class GuestController {
  constructor(private readonly guest: GuestService) {}

  @Get()
  getTable(@Param('qrToken') qrToken: string) {
    return this.guest.getTable(qrToken);
  }

  @Get('menu')
  getMenu(@Param('qrToken') qrToken: string) {
    return this.guest.getMenu(qrToken);
  }

  /** A table's orders are private to whoever holds its QR: never cached by a shared proxy. */
  @Header('Cache-Control', 'no-store')
  @Get('orders')
  listOrders(@Param('qrToken') qrToken: string) {
    return this.guest.listOrders(qrToken);
  }

  @Header('Cache-Control', 'no-store')
  @Post('orders')
  createOrder(@Param('qrToken') qrToken: string, @Body() dto: CreateOrderDto) {
    return this.guest.createOrder(qrToken, dto);
  }
}
