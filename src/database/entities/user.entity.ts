import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { UserRole } from '../enums.js';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';

@Entity('users')
export class User extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  @Column()
  name: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STAFF })
  role: UserRole;

  /** Set for seeded/admin-created accounts: must pick a new password at first login. */
  @Column({ default: false })
  mustChangePassword: boolean;

  /** Disabled accounts cannot log in or refresh; their history is kept. */
  @Column({ default: true })
  isActive: boolean;
}
