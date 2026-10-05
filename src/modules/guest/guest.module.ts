import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../../database/entities/category.entity.js';
import { DiningTable } from '../../database/entities/dining-table.entity.js';
import { OrderItem } from '../../database/entities/order-item.entity.js';
import { Order } from '../../database/entities/order.entity.js';
import { Product } from '../../database/entities/product.entity.js';
import { GuestController } from './guest.controller.js';
import { GuestService } from './guest.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DiningTable,
      Category,
      Product,
      Order,
      OrderItem,
    ]),
  ],
  controllers: [GuestController],
  providers: [GuestService],
})
export class GuestModule {}
