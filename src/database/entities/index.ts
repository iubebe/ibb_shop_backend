import { AttendanceRecord } from './attendance-record.entity.js';
import { Branch } from './branch.entity.js';
import { Category } from './category.entity.js';
import { FinanceForecast } from './finance-forecast.entity.js';
import { Expense } from './expense.entity.js';
import { DiningTable } from './dining-table.entity.js';
import { ImportReceiptLine } from './import-receipt-line.entity.js';
import { ImportReceipt } from './import-receipt.entity.js';
import { StockItemMovement } from './stock-item-movement.entity.js';
import { StockItem } from './stock-item.entity.js';
import { Supplier } from './supplier.entity.js';
import { InventoryItem } from './inventory-item.entity.js';
import { OrderItem } from './order-item.entity.js';
import { Order } from './order.entity.js';
import { PaymentQrCode } from './payment-qr-code.entity.js';
import { Product } from './product.entity.js';
import { StaffSchedule } from './staff-schedule.entity.js';
import { StaffShiftRegistration } from './staff-shift-registration.entity.js';
import { StockMovement } from './stock-movement.entity.js';
import { User } from './user.entity.js';

export {
  FinanceForecast,
  Expense,
  ImportReceiptLine,
  ImportReceipt,
  StockItemMovement,
  StockItem,
  Supplier,
  AttendanceRecord,
  Branch,
  Category,
  DiningTable,
  InventoryItem,
  Order,
  OrderItem,
  PaymentQrCode,
  Product,
  StaffSchedule,
  StaffShiftRegistration,
  StockMovement,
  User,
};

export const entities = [
  FinanceForecast,
  Expense,
  ImportReceiptLine,
  ImportReceipt,
  StockItemMovement,
  StockItem,
  Supplier,
  Branch,
  User,
  DiningTable,
  Category,
  Product,
  InventoryItem,
  StockMovement,
  PaymentQrCode,
  Order,
  OrderItem,
  AttendanceRecord,
  StaffSchedule,
  StaffShiftRegistration,
];
