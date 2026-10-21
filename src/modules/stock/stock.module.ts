import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportReceiptLine } from '../../database/entities/import-receipt-line.entity.js';
import { ImportReceipt } from '../../database/entities/import-receipt.entity.js';
import { StockItemMovement } from '../../database/entities/stock-item-movement.entity.js';
import { StockItem } from '../../database/entities/stock-item.entity.js';
import { WriteOff } from '../../database/entities/write-off.entity.js';
import { Supplier } from '../../database/entities/supplier.entity.js';
import { StockController } from './stock.controller.js';
import { StockService } from './stock.service.js';
import { WriteOffController } from './write-off.controller.js';
import { WriteOffService } from './write-off.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockItem,
      Supplier,
      ImportReceipt,
      ImportReceiptLine,
      StockItemMovement,
      WriteOff,
    ]),
  ],
  controllers: [StockController, WriteOffController],
  providers: [StockService, WriteOffService],
})
export class StockModule {}
