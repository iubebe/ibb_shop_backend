import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { FinanceService } from './finance.service.js';

/** Money in/out for the shop. Admin only: staff and cashiers never see it. */
@Roles(UserRole.ADMIN)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() query: RangeQuery) {
    return this.finance.summary(user.branchId, query.from, query.to);
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
