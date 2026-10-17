import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { StockItemKind } from '../enums.js';
import { numericTransformer } from '../transformers.js';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';

/**
 * A purchased good or material (flour, cups, beans...) with its running
 * stock. Never write `quantity` directly: go through `StockService`, which
 * records a `StockItemMovement` in the same transaction.
 */
@Entity('stock_items')
@Index(['branchId', 'name'], { unique: true })
export class StockItem extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: StockItemKind })
  kind: StockItemKind;

  /** Free text unit: kg, lít, hộp, cái... */
  @Column({ length: 30 })
  unit: string;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 3,
    default: 0,
    transformer: numericTransformer,
  })
  quantity: number;

  /** Flag as low when `quantity <= lowStockThreshold`; 0 disables the flag. */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 3,
    default: 0,
    transformer: numericTransformer,
  })
  lowStockThreshold: number;

  /** Unit cost of the latest import, a hint for the next receipt. */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  lastUnitCost: number | null;

  @Column({ default: true })
  isActive: boolean;
}
