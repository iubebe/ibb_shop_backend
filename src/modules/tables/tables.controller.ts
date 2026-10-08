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
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import { CreateTableDto, QrPdfQueryDto, UpdateTableDto } from './dto/table.dto.js';
import { TablesService } from './tables.service.js';

@Roles(UserRole.ADMIN)
@Controller('tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tables.list(user.branchId);
  }

  @Get('qr-pdf')
  async qrPdf(@CurrentUser() user: AuthUser, @Query() query: QrPdfQueryDto) {
    const pdf = await this.tables.qrPdf(user.branchId, query);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: 'attachment; filename="table-qr-codes.pdf"',
    });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTableDto) {
    return this.tables.create(user.branchId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tables.update(user.branchId, id, dto);
  }

  @Post(':id/regenerate-qr')
  regenerateQr(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tables.regenerateToken(user.branchId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tables.remove(user.branchId, id);
  }
}
