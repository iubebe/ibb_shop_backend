import type {
  ImportReceiptStatus,
  StockItemKind,
  StockItemMovementReason,
  WriteOffCause,
  WriteOffStatus,
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
  /** Days stock stays good after the latest import; null when unknown. */
  shelfLifeDays: number | null;
  isActive: boolean;
}

/** Catalog entry without quantities or costs, for staff drafting an import. */
export interface StockItemOptionView {
  id: string;
  name: string;
  kind: StockItemKind;
  unit: string;
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
  createdByUserId: string | null;
  status: ImportReceiptStatus;
  hasImage: boolean;
  rejectReason: string | null;
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

export interface WriteOffView {
  id: string;
  stockItem: { id: string; name: string; unit: string };
  quantity: number;
  cause: WriteOffCause;
  note: string | null;
  status: WriteOffStatus;
  /** Hidden (null) for staff: costs are admin-only. */
  unitCost: number | null;
  totalCost: number | null;
  writtenOffAt: Date | null;
  rejectReason: string | null;
  createdByName: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}

/** A stock item holding quantity that is at risk of spoiling or not moving. */
export interface AtRiskItemView {
  id: string;
  name: string;
  kind: StockItemKind;
  unit: string;
  quantity: number;
  lastUnitCost: number | null;
  /** `quantity * lastUnitCost`, 0 when the cost is unknown. */
  value: number;
  shelfLifeDays: number | null;
  lastImportedAt: Date | null;
  lastOutflowAt: Date | null;
  /** Latest import + shelf life; null when either is unknown. */
  estimatedExpiryAt: Date | null;
  expired: boolean;
  expiringSoon: boolean;
  stale: boolean;
  /** Whole days since the last outflow, falling back to the last import. */
  idleDays: number | null;
}
