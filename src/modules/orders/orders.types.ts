import type { OrderStatus } from '../../database/enums.js';

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
