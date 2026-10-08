import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../../database/entities/category.entity.js';
import { Product } from '../../database/entities/product.entity.js';
import { GuestModule } from '../guest/guest.module.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category]), GuestModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
