import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from '../../database/entities/expense.entity.js';
import { Investment } from '../../database/entities/investment.entity.js';
import { BreakEvenService } from './break-even.service.js';
import { FinanceExportService } from './finance-export.service.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';
import { InvestmentsService } from './investments.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, Investment])],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    InvestmentsService,
    BreakEvenService,
    FinanceExportService,
  ],
})
export class FinanceModule {}
