import { AttendanceRecord } from './attendance-record.entity.js';
import { Branch } from './branch.entity.js';
import { Category } from './category.entity.js';
import { DiningTable } from './dining-table.entity.js';
import { InventoryItem } from './inventory-item.entity.js';
import { OrderItem } from './order-item.entity.js';
import { Order } from './order.entity.js';
import { PaymentQrCode } from './payment-qr-code.entity.js';
import { Product } from './product.entity.js';
import { StockMovement } from './stock-movement.entity.js';
import { User } from './user.entity.js';

export {
  AttendanceRecord,
  Branch,
  Category,
  DiningTable,
  InventoryItem,
  Order,
  OrderItem,
  PaymentQrCode,
  Product,
  StockMovement,
  User,
};

export const entities = [
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
];
