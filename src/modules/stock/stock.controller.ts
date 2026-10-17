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
  AdjustStockDto,
  CreateImportDto,
  CreateStockItemDto,
  ListImportsQuery,
  ListMovementsQuery,
  ListStockItemsQuery,
  UpdateStockItemDto,
  UpsertSupplierDto,
} from './dto/stock.dto.js';
import { StockService } from './stock.service.js';

/** Goods/materials stock and imports. Admin only (costs are sensitive). */
@Roles(UserRole.ADMIN)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('items')
  listItems(@CurrentUser() user: AuthUser, @Query() query: ListStockItemsQuery) {
    return this.stock.listItems(user.branchId, query.kind);
  }

  @Post('items')
  createItem(@CurrentUser() user: AuthUser, @Body() dto: CreateStockItemDto) {
    return this.stock.createItem(user.branchId, dto);
  }

  @Patch('items/:id')
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStockItemDto,
  ) {
    return this.stock.updateItem(user.branchId, id, dto);
  }

  @Delete('items/:id')
  @HttpCode(204)
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stock.removeItem(user.branchId, id);
  }

  @Get('items/:id/movements')
  movements(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMovementsQuery,
  ) {
    return this.stock.itemMovements(user.branchId, id, query.limit);
  }

  @Post('items/:id/adjust')
  adjust(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.stock.adjust(user.branchId, user.id, id, dto);
  }

  @Get('suppliers')
  listSuppliers(@CurrentUser() user: AuthUser) {
    return this.stock.listSuppliers(user.branchId);
  }

  @Post('suppliers')
  createSupplier(@CurrentUser() user: AuthUser, @Body() dto: UpsertSupplierDto) {
    return this.stock.createSupplier(user.branchId, dto);
  }

  @Patch('suppliers/:id')
  updateSupplier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertSupplierDto,
  ) {
    return this.stock.updateSupplier(user.branchId, id, dto);
  }

  @Delete('suppliers/:id')
  @HttpCode(204)
  removeSupplier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stock.removeSupplier(user.branchId, id);
  }

  /** Receipts with `importedAt` in `[from, to)`. */
  @Get('imports')
  listImports(@CurrentUser() user: AuthUser, @Query() query: ListImportsQuery) {
    return this.stock.listImports(
      user.branchId,
      new Date(query.from),
      new Date(query.to),
    );
  }

  @Get('imports/:id')
  getImport(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stock.getImport(user.branchId, id);
  }

  /** Records the import and adds the stock immediately. */
  @Post('imports')
  createImport(@CurrentUser() user: AuthUser, @Body() dto: CreateImportDto) {
    return this.stock.createImport(user.branchId, user.id, dto);
  }
}
