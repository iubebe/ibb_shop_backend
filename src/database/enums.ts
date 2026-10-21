export enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff',
  CASHIER = 'cashier',
}

export enum OrderStatus {
  PENDING_CONFIRMATION = 'pending_confirmation',
  CONFIRMED = 'confirmed',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CASH = 'cash',
  QR_MANUAL = 'qr_manual',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
}

export enum StockMovementReason {
  SALE = 'sale',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  RESTOCK = 'restock',
}

/** Outcome of the (later, asynchronous) face check on an attendance photo. */
export enum FaceCheckStatus {
  PENDING = 'pending',
  PASSED = 'passed',
  FAILED = 'failed',
}

/** `goods` are bought and resold as-is; `material` is an ingredient/supply. */
export enum StockItemKind {
  GOODS = 'goods',
  MATERIAL = 'material',
}

/** Staff-drafted imports wait for admin review; admin-recorded ones are born confirmed. */
export enum ImportReceiptStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

export enum StockItemMovementReason {
  IMPORT = 'import',
  ADJUSTMENT = 'adjustment',
}

/** Operating-expense categories (salary and stock imports are tracked elsewhere). */
export enum ExpenseCategory {
  RENT = 'rent',
  ELECTRICITY = 'electricity',
  WATER = 'water',
  INTERNET = 'internet',
  GAS = 'gas',
  MAINTENANCE = 'maintenance',
  MARKETING = 'marketing',
  OTHER = 'other',
}
