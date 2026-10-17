import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { StockItemMovementReason } from '../enums.js';
import { numericTransformer } from '../transformers.js';
import { ImportReceipt } from './import-receipt.entity.js';
import { StockItem } from './stock-item.entity.js';
import { User } from './user.entity.js';

/** Append-only ledger of every change to a `StockItem.quantity`. */
@Entity('stock_item_movements')
export class StockItemMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  stockItemId: string;

  @ManyToOne(() => StockItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stockItemId' })
  stockItem: Relation<StockItem>;

  /** Positive adds stock, negative removes it. */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 3,
    transformer: numericTransformer,
  })
  change: number;

  /** Quantity right after this movement. */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 3,
    transformer: numericTransformer,
  })
  quantityAfter: number;

  @Column({ type: 'enum', enum: StockItemMovementReason })
  reason: StockItemMovementReason;

  @Column({ type: 'uuid', nullable: true })
  receiptId: string | null;

  @ManyToOne(() => ImportReceipt, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'receiptId' })
  receipt: Relation<ImportReceipt> | null;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: Relation<User> | null;
}
