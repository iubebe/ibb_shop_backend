import type {
  StockItemKind,
  StockItemMovementReason,
} from '../../database/enums.js';

export interface StockItemView {
  id: string;
  name: string;
  kind: StockItemKind;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  isLow: boolean;
  lastUnitCost: number | null;
  isActive: boolean;
}

export interface SupplierView {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
}

export interface ImportLineView {
  stockItemId: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface ImportReceiptView {
  id: string;
  code: string;
  importedAt: Date;
  supplier: { id: string; name: string } | null;
  note: string | null;
  totalCost: number;
  createdByName: string | null;
  lines: ImportLineView[];
}

export interface StockMovementView {
  id: string;
  change: number;
  quantityAfter: number;
  reason: StockItemMovementReason;
  receiptCode: string | null;
  note: string | null;
  createdAt: Date;
  createdByName: string | null;
}
