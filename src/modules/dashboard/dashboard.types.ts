import type { OrderStatus } from '../../database/enums.js';

export interface DashboardQueue {
  /** Orders waiting for reception to confirm. */
  pendingConfirmation: number;
  /** Confirmed orders not yet paid (being served). */
  confirmed: number;
  /** Units still to deliver across confirmed orders. */
  unservedItems: number;
}

export interface DashboardRecentOrder {
  id: string;
  status: OrderStatus;
  tableName: string | null;
  total: number;
  /** Total units in the order. */
  itemCount: number;
  createdAt: Date;
}

export interface DashboardTopProduct {
  productId: string;
  name: string;
  quantity: number;
  /** VND */
  revenue: number;
}

/** Money figures; only returned to admins. */
export interface DashboardSales {
  /** Sum of orders paid today (VND). */
  revenue: number;
  paidOrders: number;
  topProducts: DashboardTopProduct[];
}

export interface DashboardView {
  /** Start of the shop-local day the figures cover. */
  since: Date;
  queue: DashboardQueue;
  recentOrders: DashboardRecentOrder[];
  /** `null` for non-admin roles. */
  sales: DashboardSales | null;
}
