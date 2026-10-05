import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { FaceCheckStatus } from '../enums.js';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';
import { User } from './user.entity.js';

/**
 * One work session: a check-in photo, and a check-out photo once the shift
 * ends. `checkOutAt` stays null while the shift is open (or was forgotten).
 */
@Entity('attendance_records')
@Index(['branchId', 'checkInAt'])
@Index(['userId', 'checkInAt'])
export class AttendanceRecord extends BaseEntity {
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'timestamptz' })
  checkInAt: Date;

  /** S3 object key of the check-in photo. */
  @Column()
  checkInPhotoKey: string;

  @Column({
    type: 'enum',
    enum: FaceCheckStatus,
    default: FaceCheckStatus.PENDING,
  })
  checkInFaceStatus: FaceCheckStatus;

  @Column({ type: 'timestamptz', nullable: true })
  checkOutAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  checkOutPhotoKey: string | null;

  @Column({
    type: 'enum',
    enum: FaceCheckStatus,
    default: FaceCheckStatus.PENDING,
  })
  checkOutFaceStatus: FaceCheckStatus;

  /** Set when an admin corrected the times (audit trail for pay disputes). */
  @Column({ type: 'timestamptz', nullable: true })
  adjustedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  adjustedByUserId: string | null;
}
