import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiningTable } from '../../database/entities/dining-table.entity.js';
import { Order } from '../../database/entities/order.entity.js';
import { OrderItem } from '../../database/entities/order-item.entity.js';
import { Product } from '../../database/entities/product.entity.js';
import { PaymentQrCode } from '../../database/entities/payment-qr-code.entity.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order, DiningTable, Product, OrderItem, PaymentQrCode])],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
