import type { OrderStatus } from '../../database/enums.js';

export interface GuestTableView {
  id: string;
  name: string;
}

export interface GuestMenuView {
  categories: { id: string; name: string }[];
  products: {
    id: string;
    categoryId: string | null;
    name: string;
    price: number;
    imageUrl: string | null;
  }[];
}

export interface GuestOrderView {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: Date;
  items: {
    productId: string;
    name: string;
    quantity: number;
    servedQuantity: number;
    unitPrice: number;
    notes: string | null;
  }[];
}
