import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiningTable } from '../../database/entities/dining-table.entity.js';
import { Order } from '../../database/entities/order.entity.js';
import { OrderItem } from '../../database/entities/order-item.entity.js';
import { Product } from '../../database/entities/product.entity.js';
import { PaymentQrCode } from '../../database/entities/payment-qr-code.entity.js';
import { OrderImportController } from './order-import/order-import.controller.js';
import { OrderImportService } from './order-import/order-import.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order, DiningTable, Product, OrderItem, PaymentQrCode])],
  controllers: [OrdersController, OrderImportController],
  providers: [OrdersService, OrderImportService],
})
export class OrdersModule {}
