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
