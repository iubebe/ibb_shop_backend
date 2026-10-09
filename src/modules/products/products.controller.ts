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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto.js';
import { ListProductsQuery } from './dto/list-products.query.js';
import { IMAGE_FIELD, IMAGE_MAX_BYTES } from './product-image.js';
import { ProductsService } from './products.service.js';

/** The slice of a multer memory-storage file we use. */
interface UploadedImage {
  buffer: Buffer;
}

const imageUpload = FileInterceptor(IMAGE_FIELD, {
  limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
});

@Roles(UserRole.ADMIN)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListProductsQuery) {
    return this.products.list(user.branchId, query.categoryId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.products.create(user.branchId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(user.branchId, id, dto);
  }

  /** multipart/form-data, field `image` (JPEG/PNG/WebP, max 5 MB). Replaces the current image. */
  @Post(':id/image')
  @HttpCode(200)
  @UseInterceptors(imageUpload)
  uploadImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() image?: UploadedImage,
  ) {
    return this.products.setImage(user.branchId, id, image?.buffer);
  }

  @Delete(':id/image')
  removeImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.products.removeImage(user.branchId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.products.remove(user.branchId, id);
  }
}
