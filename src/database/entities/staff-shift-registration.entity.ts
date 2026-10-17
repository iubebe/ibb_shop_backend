import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'
import type { Relation } from 'typeorm'
import { BaseEntity } from './base.entity.js'
import { StaffSchedule } from './staff-schedule.entity.js'
import { User } from './user.entity.js'

@Entity('staff_shift_registrations')
export class StaffShiftRegistration extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  scheduleId: string

  @ManyToOne(() => StaffSchedule, (s) => s.registrations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule: Relation<StaffSchedule>

  @Index()
  @Column({ type: 'uuid' })
  staffUserId: string

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'staffUserId' })
  staffUser: Relation<User>

  /** pending, approved, rejected */
  @Index()
  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string

  /** Admin notes when approving/rejecting */
  @Column({ type: 'text', nullable: true })
  adminNotes: string | null

  @Column({ type: 'timestamp with time zone', nullable: true })
  reviewedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  reviewedByUserId: string | null

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedByUser: Relation<User> | null
}
