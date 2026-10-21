import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { WriteOffCause, WriteOffStatus } from '../enums.js';
import { numericTransformer } from '../transformers.js';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';
import { StockItem } from './stock-item.entity.js';
import { User } from './user.entity.js';

/**
 * Stock thrown away (expired, spoiled...). Stock is removed only when `status`
 * is `confirmed`: admin write-offs are confirmed at once, staff proposals stay
 * `pending` until reviewed. The cost is a snapshot taken at confirmation.
 */
@Entity('write_offs')
export class WriteOff extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  @Index()
  @Column({ type: 'uuid' })
  stockItemId: string;

  @ManyToOne(() => StockItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stockItemId' })
  stockItem: Relation<StockItem>;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 3,
    transformer: numericTransformer,
  })
  quantity: number;

  @Column({ type: 'enum', enum: WriteOffCause })
  cause: WriteOffCause;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({
    type: 'enum',
    enum: WriteOffStatus,
    default: WriteOffStatus.CONFIRMED,
  })
  status: WriteOffStatus;

  /** The item's `lastUnitCost` when confirmed (0 until then or when unknown). */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  unitCost: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalCost: number;

  /** When the stock was actually removed; drives the finance loss date. */
  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  writtenOffAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  rejectReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: Relation<User> | null;
}
