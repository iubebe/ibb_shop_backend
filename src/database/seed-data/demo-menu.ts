/** Demo catalog moved from the guest app's mock data. Prices in VND. */
export const DEMO_CATEGORIES = [
  'Món chính',
  'Món cuốn',
  'Nem nướng',
  'Đồ uống',
] as const;

export const DEMO_PRODUCTS: ReadonlyArray<{
  name: string;
  category: (typeof DEMO_CATEGORIES)[number];
  price: number;
}> = [
  { name: 'Mẹt 3 Miền', category: 'Món chính', price: 129_000 },
  { name: 'Bún mắm Heo Quay', category: 'Món chính', price: 65_000 },
  { name: 'Bánh tráng cuốn thịt heo', category: 'Món cuốn', price: 70_000 },
  { name: 'Nem lụi Huế', category: 'Nem nướng', price: 70_000 },
  { name: 'Nem bò nướng sả', category: 'Nem nướng', price: 80_000 },
  { name: 'Trà Chanh Nha Đam hạt chia', category: 'Đồ uống', price: 30_000 },
  { name: 'Trà Sâm Dứa Nha Đam hạt chia', category: 'Đồ uống', price: 15_000 },
  { name: 'Nước sâm dứa', category: 'Đồ uống', price: 10_000 },
  { name: 'Lavie', category: 'Đồ uống', price: 10_000 },
  { name: 'Pepsi/Coca', category: 'Đồ uống', price: 20_000 },
];

export const DEMO_TABLE_COUNT = 12;

/** Predictable tokens for local dev only; the seed refuses to run in production. */
export const demoTableToken = (n: number) =>
  `demo-table-${String(n).padStart(2, '0')}`;

/** Sample orders (by table number) so the orders tab has something to show. */
export const DEMO_ORDERS: ReadonlyArray<{
  table: number;
  status: 'pending_confirmation' | 'confirmed';
  items: ReadonlyArray<{ product: string; quantity: number }>;
}> = [
  {
    table: 1,
    status: 'confirmed',
    items: [
      { product: 'Mẹt 3 Miền', quantity: 1 },
      { product: 'Nem lụi Huế', quantity: 2 },
    ],
  },
  {
    table: 1,
    status: 'pending_confirmation',
    items: [{ product: 'Bún mắm Heo Quay', quantity: 2 }],
  },
  {
    table: 2,
    status: 'pending_confirmation',
    items: [{ product: 'Nem bò nướng sả', quantity: 1 }],
  },
];
