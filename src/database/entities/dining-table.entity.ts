import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';

/** A physical table. Named `DiningTable` to avoid clashing with SQL/TypeORM "Table". */
@Entity('tables')
export class DiningTable extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  /** e.g. "Table 4" */
  @Column()
  name: string;

  /** Used in the guest URL: `guest.app.com/t/{qrToken}`. */
  @Index({ unique: true })
  @Column()
  qrToken: string;
}
