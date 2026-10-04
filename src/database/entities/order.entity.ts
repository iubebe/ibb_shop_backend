import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../enums.js';
import { numericTransformer } from '../transformers.js';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';
import { DiningTable } from './dining-table.entity.js';
import { OrderItem } from './order-item.entity.js';
import { User } from './user.entity.js';

@Entity('orders')
@Index(['branchId', 'status'])
export class Order extends BaseEntity {
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  /** Null for a manually-created order that is not tied to a table. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  tableId: string | null;

  @ManyToOne(() => DiningTable, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tableId' })
  table: Relation<DiningTable> | null;

  /** Null when the guest submitted the order. */
  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: Relation<User> | null;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING_CONFIRMATION,
  })
  status: OrderStatus;

  /** Set at checkout on the POS. */
  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  total: number;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: Relation<OrderItem[]>;
}
