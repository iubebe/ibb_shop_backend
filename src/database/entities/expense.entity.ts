import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { ExpenseCategory } from '../enums.js';
import { numericTransformer } from '../transformers.js';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';
import { User } from './user.entity.js';

/** An operating cost (rent, water, electricity, ...) paid on `incurredOn`. */
@Entity('expenses')
export class Expense extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  @Column({ type: 'enum', enum: ExpenseCategory })
  category: ExpenseCategory;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  amount: number;

  /** Calendar day (shop timezone) the cost belongs to, `YYYY-MM-DD`. */
  @Index()
  @Column({ type: 'date' })
  incurredOn: string;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: Relation<User> | null;
}
