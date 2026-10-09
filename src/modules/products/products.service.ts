import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { Category } from '../../database/entities/category.entity.js';
import { Product } from '../../database/entities/product.entity.js';
import { S3Service } from '../../s3/s3.service.js';
import { detectImage } from './product-image.js';
import type { CreateProductDto, UpdateProductDto } from './dto/product.dto.js';
import type { ProductView } from './products.types.js';
import { GuestService } from '../guest/guest.service.js';

/** Postgres foreign_key_violation. */
const FK_VIOLATION = '23503';

/** Admin CRUD for products (inactive ones included), scoped to the user's branch. */
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    private readonly s3: S3Service,
    private readonly guestService: GuestService,
  ) {}

  async list(branchId: string, categoryId?: string): Promise<ProductView[]> {
    const rows = await this.products.find({
      where: { branchId, ...(categoryId ? { categoryId } : {}) },
      order: { createdAt: 'ASC' },
    });
    return rows.map(view);
  }

  async create(branchId: string, dto: CreateProductDto): Promise<ProductView> {
    await this.assertCategory(branchId, dto.categoryId);
    const saved = await this.products.save(
      this.products.create({
        branchId,
        name: dto.name,
        price: dto.price,
        categoryId: dto.categoryId ?? null,
        imageUrl: dto.imageUrl ?? null,
        isActive: dto.isActive ?? true,
      }),
    );
    await this.guestService.revalidateMenuCache(branchId);
    return view(saved);
  }

  async update(
    branchId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductView> {
    const product = await this.find(branchId, id);
    if (dto.categoryId !== undefined) {
      await this.assertCategory(branchId, dto.categoryId);
      product.categoryId = dto.categoryId;
    }
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.price !== undefined) product.price = dto.price;
    const oldImageUrl = product.imageUrl;
    if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;
    const saved = await this.products.save(product);
    if (dto.imageUrl !== undefined && oldImageUrl !== saved.imageUrl) {
      await this.deleteStoredImage(oldImageUrl);
    }
    await this.guestService.revalidateMenuCache(branchId);
    return view(saved);
  }

  /** Stores the upload in S3 (served publicly as media.<domain>) and points the product at it. */
  async setImage(
    branchId: string,
    id: string,
    buffer: Buffer | undefined,
  ): Promise<ProductView> {
    const { ext, contentType } = detectImage(buffer);
    const product = await this.find(branchId, id);
    const { url } = await this.s3.upload(
      `products/${branchId}/${randomUUID()}.${ext}`,
      buffer!,
      // Keys are unique per upload, so the object never changes.
      { contentType, cacheControl: 'public, max-age=31536000, immutable' },
    );
    const oldImageUrl = product.imageUrl;
    product.imageUrl = url;
    const saved = await this.products.save(product);
    await this.deleteStoredImage(oldImageUrl);
    return view(saved);
  }

  async removeImage(branchId: string, id: string): Promise<ProductView> {
    const product = await this.find(branchId, id);
    const oldImageUrl = product.imageUrl;
    product.imageUrl = null;
    const saved = await this.products.save(product);
    await this.deleteStoredImage(oldImageUrl);
    return view(saved);
  }

  /** Products that appear in orders can't be deleted (order history); deactivate them instead. */
  async remove(branchId: string, id: string): Promise<void> {
    const product = await this.find(branchId, id);
    const imageUrl = product.imageUrl;
    try {
      await this.products.remove(product);
      await this.deleteStoredImage(imageUrl);
      await this.guestService.revalidateMenuCache(branchId);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string } | undefined)?.code === FK_VIOLATION
      ) {
        throw new ConflictException(
          'Product is used by existing orders; deactivate it instead',
        );
      }
      throw err;
    }
  }

  /** Best effort: only our own objects; a failed cleanup must not fail the request. */
  private async deleteStoredImage(url: string | null): Promise<void> {
    const key = url ? this.s3.keyFromPublicUrl(url) : null;
    if (!key) return;
    try {
      await this.s3.delete(key);
    } catch {
      // orphaned object, harmless
    }
  }

  private async find(branchId: string, id: string) {
    const product = await this.products.findOneBy({ id, branchId });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async assertCategory(branchId: string, categoryId?: string | null) {
    if (!categoryId) return;
    const exists = await this.categories.existsBy({ id: categoryId, branchId });
    if (!exists) throw new BadRequestException('Unknown category');
  }
}

function view(p: Product): ProductView {
  return {
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    price: p.price,
    imageUrl: p.imageUrl,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
