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

  /** S3 key of the uploaded image (column name kept for the existing API contract). */
  @Column()
  imagePath: string;

  /** Text decoded from the image when it is a VietQR; null = static image only (no per-order amount). */
  @Column({ type: 'text', nullable: true })
  qrPayload: string | null;

  @Column({ default: true })
  isActive: boolean;
}
