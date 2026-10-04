import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../database/entities/category.entity.js';
import { Product } from '../../database/entities/product.entity.js';
import type { CategoryView } from './categories.types.js';

/** Admin CRUD for menu categories, always scoped to the user's branch. */
@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
  ) {}

  async list(branchId: string): Promise<CategoryView[]> {
    const rows = await this.categories
      .createQueryBuilder('c')
      .leftJoin('products', 'p', 'p."categoryId" = c.id')
      .where('c."branchId" = :branchId', { branchId })
      .select('c.id', 'id')
      .addSelect('c.name', 'name')
      .addSelect('c."createdAt"', 'createdAt')
      .addSelect('COUNT(p.id)::int', 'productCount')
      .groupBy('c.id')
      .orderBy('c."createdAt"', 'ASC')
      .getRawMany<CategoryView>();
    return rows;
  }

  async create(branchId: string, name: string): Promise<CategoryView> {
    await this.assertNameFree(branchId, name);
    const saved = await this.categories.save(
      this.categories.create({ branchId, name }),
    );
    return view(saved, 0);
  }

  async update(
    branchId: string,
    id: string,
    patch: { name?: string },
  ): Promise<CategoryView> {
    const category = await this.find(branchId, id);
    if (patch.name !== undefined && patch.name !== category.name) {
      await this.assertNameFree(branchId, patch.name, id);
      category.name = patch.name;
      await this.categories.save(category);
    }
    return view(category, await this.countProducts(id));
  }

  /** Products in the category are kept and become uncategorized (FK SET NULL). */
  async remove(branchId: string, id: string): Promise<void> {
    const category = await this.find(branchId, id);
    await this.categories.remove(category);
  }

  private async find(branchId: string, id: string) {
    const category = await this.categories.findOneBy({ id, branchId });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private countProducts(id: string) {
    return this.categories.manager.countBy(Product, { categoryId: id });
  }

  private async assertNameFree(branchId: string, name: string, exceptId?: string) {
    const clash = await this.categories
      .createQueryBuilder('c')
      .where('c."branchId" = :branchId AND LOWER(c.name) = LOWER(:name)', {
        branchId,
        name,
      })
      .getOne();
    if (clash && clash.id !== exceptId) {
      throw new ConflictException('A category with this name already exists');
    }
  }
}

function view(category: Category, productCount: number): CategoryView {
  return {
    id: category.id,
    name: category.name,
    productCount,
    createdAt: category.createdAt,
  };
}
