export interface CustomerView {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  /** Orders linked to this customer, cancelled ones excluded. */
  orderCount: number;
  /** Sum of the paid orders. */
  totalSpent: number;
  lastOrderAt: Date | null;
  createdAt: Date;
}

/** What staff get when looking a customer up by phone while creating an order. */
export interface CustomerLookupView {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
}
