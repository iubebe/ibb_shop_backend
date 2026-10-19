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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import {
  AdjustStockDto,
  ConfirmImportDto,
  CreateImportDraftDto,
  CreateImportDto,
  CreateStockItemDto,
  ListImportsQuery,
  ListMovementsQuery,
  ListStockItemsQuery,
  RejectImportDto,
  UpdateStockItemDto,
  UpsertSupplierDto,
} from './dto/stock.dto.js';
import { IMAGE_FIELD, IMAGE_MAX_BYTES } from '../products/product-image.js';
import { StockService } from './stock.service.js';

const receiptImageUpload = FileInterceptor(IMAGE_FIELD, {
  limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
});

/**
 * Goods/materials stock and imports. Admin only (costs are sensitive), except
 * the few endpoints staff need to draft an import for admin review.
 */
@Roles(UserRole.ADMIN)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  /** Names and units only (no quantities or costs): what staff pick from when drafting. */
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get('items/options')
  itemOptions(@CurrentUser() user: AuthUser) {
    return this.stock.listItemOptions(user.branchId);
  }

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

  @Roles(UserRole.ADMIN, UserRole.STAFF)
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

  /** The caller's own drafts with their review outcome. */
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get('imports/mine')
  listMyImports(@CurrentUser() user: AuthUser) {
    return this.stock.listMine(user.branchId, user.id);
  }

  /** multipart/form-data: `image`, `lines` (JSON string), optional `supplierId`, `note`. Stock is not changed. */
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Post('imports/drafts')
  @UseInterceptors(receiptImageUpload)
  createImportDraft(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateImportDraftDto,
    @UploadedFile() image?: { buffer: Buffer },
  ) {
    return this.stock.createDraft(user.branchId, user.id, dto, image?.buffer);
  }

  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get('imports/:id/image')
  async getImportImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const img = await this.stock.getImportImage(user.branchId, user, id);
    return new StreamableFile(img.body, {
      type: img.contentType,
      length: img.contentLength,
      disposition: 'inline',
    });
  }

  /** Withdraw a pending draft (author or admin). */
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Delete('imports/:id')
  @HttpCode(204)
  cancelImportDraft(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stock.cancelDraft(user.branchId, user, id);
  }

  @Post('imports/:id/confirm')
  confirmImport(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmImportDto,
  ) {
    return this.stock.confirmImport(user.branchId, user.id, id, dto);
  }

  @Post('imports/:id/reject')
  rejectImport(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectImportDto,
  ) {
    return this.stock.rejectImport(user.branchId, user.id, id, dto.reason);
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
