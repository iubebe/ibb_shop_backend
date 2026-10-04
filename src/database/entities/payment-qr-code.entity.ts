import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';

@Entity('payment_qr_codes')
export class PaymentQrCode extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  /** e.g. "Bank transfer", "MoMo" */
  @Column()
  label: string;

  /** Local disk path/URL of the uploaded image, served by the API. */
  @Column()
  imagePath: string;

  @Column({ default: true })
  isActive: boolean;
}
