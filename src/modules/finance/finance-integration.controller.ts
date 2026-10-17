import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { ServiceAuth } from '../../auth/decorators/service-auth.decorator.js';
import { UserRole } from '../../database/enums.js';
import { CreateForecastDto, ExportQuery } from './dto/forecast.dto.js';
import { FinanceExportService } from './finance-export.service.js';
import { FinanceForecastService } from './finance-forecast.service.js';

/**
 * Hand-off to the external forecasting model. `export` and `POST forecasts`
 * are for the model (bearer `FORECAST_API_TOKEN`); `GET forecasts/latest` is
 * for admins in the SMS.
 */
@Controller('finance')
export class FinanceIntegrationController {
  constructor(
    private readonly exports: FinanceExportService,
    private readonly forecasts: FinanceForecastService,
  ) {}

  @ServiceAuth()
  @Get('export')
  export(@Query() query: ExportQuery) {
    return this.exports.export(query.from, query.to);
  }

  @ServiceAuth()
  @Post('forecasts')
  async createForecast(@Body() dto: CreateForecastDto) {
    const branchId = await this.exports.resolveBranch();
    return this.forecasts.create(branchId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Get('forecasts/latest')
  latest(@CurrentUser() user: AuthUser) {
    return this.forecasts.latest(user.branchId);
  }
}
