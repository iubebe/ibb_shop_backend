import type { OrderStatus, PaymentMethod } from '../../database/enums.js';

export interface StaffOrderView {
  id: string;
  status: OrderStatus;
  tableId: string | null;
  tableName: string | null;
  total: number;
  createdAt: Date;
  confirmedAt: Date | null;
  items: {
    id: string;
    productId: string;
    name: string;
    quantity: number;
    servedQuantity: number;
    notes: string | null;
  }[];
}

export interface ServedItemView {
  id: string;
  quantity: number;
  servedQuantity: number;
}

/** Result of a status transition (confirm, cancel, pay). */
export interface OrderTransitionView {
  id: string;
  status: OrderStatus;
  confirmedAt: Date | null;
  paidAt: Date | null;
  paymentMethod: PaymentMethod | null;
}
