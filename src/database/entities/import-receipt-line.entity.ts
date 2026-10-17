import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { numericTransformer } from '../transformers.js';
import { BaseEntity } from './base.entity.js';
import { ImportReceipt } from './import-receipt.entity.js';
import { StockItem } from './stock-item.entity.js';

@Entity('import_receipt_lines')
export class ImportReceiptLine extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  receiptId: string;

  @ManyToOne(() => ImportReceipt, (receipt) => receipt.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'receiptId' })
  receipt: Relation<ImportReceipt>;

  @Index()
  @Column({ type: 'uuid' })
  stockItemId: string;

  @ManyToOne(() => StockItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stockItemId' })
  stockItem: Relation<StockItem>;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 3,
    transformer: numericTransformer,
  })
  quantity: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  unitCost: number;
}
