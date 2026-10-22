import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from '../../database/entities/expense.entity.js';
import { FinanceExportService } from './finance-export.service.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Expense])],
  controllers: [FinanceController],
  providers: [FinanceService, FinanceExportService],
})
export class FinanceModule {}
