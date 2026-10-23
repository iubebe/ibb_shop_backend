import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { InvestmentCategory } from '../enums.js';
import { numericTransformer } from '../transformers.js';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';
import { User } from './user.entity.js';

/** A one-off capital spend (equipment, fit-out, ...) paid on `investedOn`; the base of the ROI figure. */
@Entity('investments')
export class Investment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'enum', enum: InvestmentCategory })
  category: InvestmentCategory;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  amount: number;

  /** Calendar day (shop timezone) the money was spent, `YYYY-MM-DD`. */
  @Index()
  @Column({ type: 'date' })
  investedOn: string;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: Relation<User> | null;
}
