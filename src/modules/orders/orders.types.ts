import type { OrderStatus } from '../../database/enums.js';
import type { VietQrBank } from '../payment-qr-codes/vietqr.js';

export interface StaffOrderView {
  id: string;
  status: OrderStatus;
  tableId: string | null;
  tableName: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  deliveryAt: Date | null;
  total: number;
  createdAt: Date;
  confirmedAt: Date | null;
  items: {
    id: string;
    productId: string;
    name: string;
    quantity: number;
    servedQuantity: number;
    unitPrice: number;
    notes: string | null;
  }[];
}

export interface ServedItemView {
  id: string;
  quantity: number;
  servedQuantity: number;
}

export interface OrderPaymentQrView {
  id: string;
  label: string;
  /** VietQR text with this order's total and note; null when the QR image is not a VietQR. */
  dynamicPayload: string | null;
  bank: VietQrBank | null;
}
