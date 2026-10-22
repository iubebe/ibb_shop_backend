import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import {
  CreateExpenseDto,
  RangeQuery,
  UpdateExpenseDto,
} from './dto/finance.dto.js';
import { FinanceExportService } from './finance-export.service.js';
import { FinanceService } from './finance.service.js';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Money in/out for the shop. Admin only: staff and cashiers never see it. */
@Roles(UserRole.ADMIN)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly exporter: FinanceExportService,
  ) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() query: RangeQuery) {
    return this.finance.summary(user.branchId, query.from, query.to);
  }

  /** Excel report (tables plus charts) for the same `[from, to)` range. */
  @Get('export')
  @Header('Content-Type', XLSX_CONTENT_TYPE)
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: RangeQuery,
  ): Promise<StreamableFile> {
    const file = await this.exporter.exportXlsx(
      user.branchId,
      query.from,
      query.to,
    );
    return new StreamableFile(file, {
      type: XLSX_CONTENT_TYPE,
      disposition: `attachment; filename="finance-${query.from}_${query.to}.xlsx"`,
    });
  }

  @Get('expenses')
  listExpenses(@CurrentUser() user: AuthUser, @Query() query: RangeQuery) {
    return this.finance.listExpenses(user.branchId, query.from, query.to);
  }

  @Post('expenses')
  createExpense(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.finance.createExpense(user.branchId, user.id, dto);
  }

  @Patch('expenses/:id')
  updateExpense(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.finance.updateExpense(user.branchId, id, dto);
  }

  @Delete('expenses/:id')
  @HttpCode(204)
  removeExpense(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.finance.removeExpense(user.branchId, id);
  }
}
