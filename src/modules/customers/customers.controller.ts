import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import { CustomersService } from './customers.service.js';
import { ListCustomersQuery } from './dto/list-customers.query.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

@Roles(UserRole.ADMIN)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListCustomersQuery) {
    return this.customers.list(user.branchId, query.search);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.get(user.branchId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(user.branchId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.remove(user.branchId, id);
  }
}
