import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';

/**
 * A person who ordered, created from the optional customer fields of an order.
 * Phone is the identity when present: one customer per (branch, phone).
 */
@Entity('customers')
@Index(['branchId', 'phone'], { unique: true, where: '"phone" IS NOT NULL' })
export class Customer extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  /** Digits with an optional leading `+` (see `normalizePhone`). */
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;
}
