import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import type { AuthUser } from '../../../auth/auth.types.js';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../../database/enums.js';
import { BackdatedOrdersService, shopTime } from './backdated-orders.service.js';
import { CreateBackdatedOrdersDto } from './dto/create-backdated-orders.dto.js';

@Roles(UserRole.ADMIN)
@Controller('orders/backdated')
export class BackdatedOrdersController {
  constructor(private readonly backdated: BackdatedOrdersService) {}

  /** Admin records several finished (paid) orders for one past day. */
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBackdatedOrdersDto) {
    const drafts = dto.orders.map((order) => {
      const orderedAt = shopTime(dto.date, order.time);
      if (!orderedAt) throw new BadRequestException(`Invalid date "${dto.date}"`);
      return {
        tableId: order.tableId,
        orderedAt,
        paymentMethod: dto.paymentMethod,
        lines: order.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          notes: i.notes?.trim() || null,
        })),
      };
    });
    const orders = await this.backdated.createMany(user.branchId, user.id, drafts);
    return { created: orders.length, orders };
  }
}
