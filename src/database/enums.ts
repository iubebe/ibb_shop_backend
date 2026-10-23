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
  WRITE_OFF = 'write_off',
}

/** Why stock was thrown away. */
export enum WriteOffCause {
  EXPIRED = 'expired',
  SPOILED = 'spoiled',
  DAMAGED = 'damaged',
  OTHER = 'other',
}

/** Staff proposals wait for admin review; admin write-offs are born confirmed. */
export enum WriteOffStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
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

/** Capital investments (fit-out, equipment, ...): one-off spend tracked for ROI, not an operating cost. */
export enum InvestmentCategory {
  RENOVATION = 'renovation',
  EQUIPMENT = 'equipment',
  FURNITURE = 'furniture',
  TECHNOLOGY = 'technology',
  DEPOSIT = 'deposit',
  OTHER = 'other',
}

/** `T:` field of the WiFi QR payload. */
export enum WifiSecurity {
  WPA = 'WPA',
  WEP = 'WEP',
  OPEN = 'nopass',
}
