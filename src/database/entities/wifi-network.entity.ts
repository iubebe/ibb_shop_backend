import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { WifiSecurity } from '../enums.js';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';

/**
 * A guest WiFi network. The password is never stored: it is accepted once, encoded
 * into a QR image (private S3 bucket) and discarded. At most one network per
 * branch is active; that one is printed on the table QR sheet.
 */
@Entity('wifi_networks')
@Index('UQ_wifi_networks_active_per_branch', ['branchId'], {
  unique: true,
  where: '"isActive" = true',
})
export class WifiNetwork extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  @Column()
  ssid: string;

  @Column({ type: 'varchar' })
  security: WifiSecurity;

  @Column({ default: false })
  hidden: boolean;

  /** S3 key of the QR image in the `wifi-qr` bucket. */
  @Column()
  imagePath: string;

  @Column({ default: false })
  isActive: boolean;
}
