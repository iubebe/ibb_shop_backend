import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ImportReceiptStatus } from '../enums.js';
import { numericTransformer } from '../transformers.js';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';
import { ImportReceiptLine } from './import-receipt-line.entity.js';
import { Supplier } from './supplier.entity.js';
import { User } from './user.entity.js';

/**
 * A stock import. Stock is added only when `status` is `confirmed`: admin
 * imports are confirmed at once, staff drafts stay `pending` until reviewed.
 */
@Entity('import_receipts')
@Index(['branchId', 'code'], { unique: true })
export class ImportReceipt extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  /** Human code, e.g. `PN-20261017-001`, unique per branch. */
  @Column({ length: 30 })
  code: string;

  @Column({ type: 'uuid', nullable: true })
  supplierId: string | null;

  @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplierId' })
  supplier: Relation<Supplier> | null;

  @Index()
  @Column({ type: 'timestamptz' })
  importedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  totalCost: number;

  @Column({
    type: 'enum',
    enum: ImportReceiptStatus,
    default: ImportReceiptStatus.CONFIRMED,
  })
  status: ImportReceiptStatus;

  /** S3 key (bucket `import-receipts`) of the photographed invoice/goods. */
  @Column({ type: 'varchar', nullable: true })
  imageKey: string | null;

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

  @OneToMany(() => ImportReceiptLine, (line) => line.receipt)
  lines: Relation<ImportReceiptLine[]>;
}
