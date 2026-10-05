import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity.js';

@Entity('branches')
export class Branch extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;
}
