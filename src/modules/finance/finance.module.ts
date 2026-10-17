import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from '../../database/entities/expense.entity.js';
import { FinanceForecast } from '../../database/entities/finance-forecast.entity.js';
import { FinanceExportService } from './finance-export.service.js';
import { FinanceForecastService } from './finance-forecast.service.js';
import { FinanceIntegrationController } from './finance-integration.controller.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, FinanceForecast])],
  controllers: [FinanceController, FinanceIntegrationController],
  providers: [FinanceService, FinanceExportService, FinanceForecastService],
})
export class FinanceModule {}
