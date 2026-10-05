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
import { StockMovementReason } from '../enums.js';
import { InventoryItem } from './inventory-item.entity.js';
import { User } from './user.entity.js';

/** Append-only: no `updatedAt`. */
@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  inventoryItemId: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: Relation<InventoryItem>;

  /** Positive adds stock, negative removes it. */
  @Column({ type: 'int' })
  change: number;

  @Column({ type: 'enum', enum: StockMovementReason })
  reason: StockMovementReason;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: Relation<User> | null;
}
