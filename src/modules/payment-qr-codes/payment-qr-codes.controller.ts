import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import { IMAGE_FIELD, IMAGE_MAX_BYTES } from '../products/product-image.js';
import {
  CreatePaymentQrCodeDto,
  UpdatePaymentQrCodeDto,
} from './dto/payment-qr-code.dto.js';
import { PaymentQrCodesService } from './payment-qr-codes.service.js';

/** The slice of a multer memory-storage file we use. */
interface UploadedImage {
  buffer: Buffer;
}

const imageUpload = FileInterceptor(IMAGE_FIELD, {
  limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
});

@Roles(UserRole.ADMIN)
@Controller('payment-qr-codes')
export class PaymentQrCodesController {
  constructor(private readonly qrCodes: PaymentQrCodesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.qrCodes.list(user.branchId);
  }

  /** multipart/form-data: field `image` (JPEG/PNG/WebP, max 5 MB) plus `label`. */
  @Post()
  @UseInterceptors(imageUpload)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePaymentQrCodeDto,
    @UploadedFile() image?: UploadedImage,
  ) {
    return this.qrCodes.create(user.branchId, dto.label, image?.buffer);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentQrCodeDto,
  ) {
    return this.qrCodes.update(user.branchId, id, dto);
  }

  /** multipart/form-data, field `image`. Replaces the current image. */
  @Post(':id/image')
  @UseInterceptors(imageUpload)
  replaceImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() image?: UploadedImage,
  ) {
    return this.qrCodes.replaceImage(user.branchId, id, image?.buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.qrCodes.remove(user.branchId, id);
  }
}
