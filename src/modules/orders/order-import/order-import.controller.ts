import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../../../auth/auth.types.js';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../../database/enums.js';
import {
  ORDER_IMPORT_FIELD,
  ORDER_IMPORT_MAX_BYTES,
  ORDER_IMPORT_TEMPLATE_NAME,
  XLSX_CONTENT_TYPE,
} from './order-import.constants.js';
import { OrderImportService } from './order-import.service.js';

/** The slice of a multer memory-storage file we use. */
interface UploadedWorkbook {
  buffer: Buffer;
}

const workbookUpload = FileInterceptor(ORDER_IMPORT_FIELD, {
  limits: { fileSize: ORDER_IMPORT_MAX_BYTES, files: 1 },
});

@Roles(UserRole.ADMIN, UserRole.STAFF)
@Controller('orders/import')
export class OrderImportController {
  constructor(private readonly imports: OrderImportService) {}

  /** Excel template with the header row and the branch's table and product names. */
  @Get('template')
  @Header('Content-Type', XLSX_CONTENT_TYPE)
  async template(@CurrentUser() user: AuthUser): Promise<StreamableFile> {
    const file = await this.imports.template(user.branchId);
    return new StreamableFile(file, {
      type: XLSX_CONTENT_TYPE,
      disposition: `attachment; filename="${ORDER_IMPORT_TEMPLATE_NAME}"`,
    });
  }

  /** Multipart upload, field `file`. Creates every order in the file or none. */
  @Post()
  @UseInterceptors(workbookUpload)
  import(
    @CurrentUser() user: AuthUser,
    @UploadedFile() workbook?: UploadedWorkbook,
  ) {
    if (!workbook?.buffer) {
      throw new BadRequestException(`Upload an .xlsx file in field "${ORDER_IMPORT_FIELD}"`);
    }
    return this.imports.import(user.branchId, user.id, workbook.buffer);
  }
}
