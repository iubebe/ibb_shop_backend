import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm'
import type { Relation } from 'typeorm'
import { BaseEntity } from './base.entity.js'
import { Branch } from './branch.entity.js'
import { User } from './user.entity.js'
import { StaffShiftRegistration } from './staff-shift-registration.entity.js'

@Entity('staff_schedules')
export class StaffSchedule extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  branchId: string

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>

  @Index()
  @Column({ type: 'uuid', nullable: true })
  assignedToUserId: string | null

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'assignedToUserId' })
  assignedToUser: Relation<User> | null

  /** Start date of the shift week (Monday) */
  @Index()
  @Column({ type: 'date' })
  weekStartDate: string

  /** Day of week (1=Monday, 7=Sunday) */
  @Column({ type: 'int' })
  dayOfWeek: number

  /** Start time (HH:mm format) */
  @Column({ type: 'varchar', length: 5 })
  startTime: string

  /** End time (HH:mm format) */
  @Column({ type: 'varchar', length: 5 })
  endTime: string

  /** morning, afternoon, night, etc */
  @Column({ type: 'varchar', length: 50, nullable: true })
  shiftType: string | null

  /** Position/role: cashier, kitchen, waiter */
  @Column({ type: 'varchar', length: 100, nullable: true })
  position: string | null

  /** proposed (staff suggestion, waiting for admin), scheduled (open for registration), rejected, cancelled, no-show */
  @Column({ type: 'varchar', length: 50, default: 'scheduled' })
  status: string

  /** Staff member who proposed the shift; null for admin-created shifts */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  proposedByUserId: string | null

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'proposedByUserId' })
  proposedByUser: Relation<User> | null

  @Column({ type: 'uuid', nullable: true })
  reviewedByUserId: string | null

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedByUser: Relation<User> | null

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null

  @Column({ type: 'text', nullable: true })
  reviewNotes: string | null

  /** Shift registrations from staff */
  @OneToMany(() => StaffShiftRegistration, (reg) => reg.schedule, { cascade: true })
  registrations: Relation<StaffShiftRegistration>[]
}
