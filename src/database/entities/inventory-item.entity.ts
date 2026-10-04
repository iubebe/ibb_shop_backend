import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';
import { Product } from './product.entity.js';

/**
 * Current stock of a product. Never write `quantity` directly: record a
 * `StockMovement` and apply it, so the audit trail stays complete.
 */
@Entity('inventory_items')
export class InventoryItem extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  /** Unique: one inventory row per product (products are already per-branch). */
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Relation<Product>;

  @Column({ type: 'int', default: 0 })
  quantity: number;
}
