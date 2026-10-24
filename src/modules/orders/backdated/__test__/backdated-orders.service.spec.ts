import { BadRequestException } from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../../../../database/enums.js';
import { BackdatedOrdersService, shopTime } from '../backdated-orders.service.js';

const tables = [{ id: 't1', name: 'Bàn 1', branchId: 'b1' }];
const products = [
  { id: 'p1', price: 50000, isActive: true, branchId: 'b1' },
  { id: 'p2', price: 5000, isActive: true, branchId: 'b1' },
];

function build(found: { tables?: unknown[]; products?: unknown[] } = {}) {
  const saves: any[][] = [];
  const manager = {
    find: vi.fn(async (entity: { name: string }) =>
      entity.name === 'DiningTable' ? (found.tables ?? tables) : (found.products ?? products),
    ),
    create: vi.fn((_e: unknown, data: object) => ({ ...data })),
    save: vi.fn(async (data: any[]) => {
      saves.push(data);
      return data[0].orderId === undefined ? data.map((d, i) => ({ ...d, id: `o${i + 1}` })) : data;
    }),
  };
  const dataSource = { transaction: vi.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)) };
  return { service: new BackdatedOrdersService(dataSource as never), manager, saves };
}

const past = new Date('2026-10-20T12:00:00+07:00');
const draft = (over: object = {}) => ({
  tableId: 't1',
  orderedAt: past,
  paymentMethod: PaymentMethod.CASH,
  lines: [
    { productId: 'p1', quantity: 2, notes: 'a' },
    { productId: 'p1', quantity: 1, notes: 'b' },
    { productId: 'p2', quantity: 1, notes: null },
  ],
  ...over,
});

describe('BackdatedOrdersService.createMany', () => {
  it('writes paid, fully served orders stamped with the given time', async () => {
    const ctx = build();

    const result = await ctx.service.createMany('b1', 'u1', [draft()]);

    expect(result).toEqual([{ id: 'o1', tableName: 'Bàn 1', orderedAt: past, itemCount: 2, total: 155000 }]);
    expect(ctx.saves[0][0]).toMatchObject({
      branchId: 'b1',
      createdByUserId: 'u1',
      status: OrderStatus.PAID,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CASH,
      confirmedAt: past,
      paidAt: past,
      createdAt: past,
      total: 155000,
    });
    expect(ctx.saves[1]).toEqual([
      expect.objectContaining({ productId: 'p1', quantity: 3, servedQuantity: 3, unitPrice: 50000, notes: 'a; b' }),
      expect.objectContaining({ productId: 'p2', quantity: 1, servedQuantity: 1, unitPrice: 5000, notes: null }),
    ]);
  });

  it('rejects a time in the future before touching the database', async () => {
    const ctx = build();
    const future = new Date(Date.now() + 86_400_000);

    await expect(ctx.service.createMany('b1', 'u1', [draft({ orderedAt: future })])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ctx.manager.find).not.toHaveBeenCalled();
  });

  it('rejects unknown tables and unavailable products', async () => {
    await expect(build({ tables: [] }).service.createMany('b1', 'u1', [draft()])).rejects.toThrow('tables');
    await expect(build({ products: [products[0]] }).service.createMany('b1', 'u1', [draft()])).rejects.toThrow(
      'products',
    );
  });
});

describe('shopTime', () => {
  it('converts shop wall-clock time to an instant', () => {
    expect(shopTime('2026-10-20', '08:00')).toEqual(new Date('2026-10-20T01:00:00Z'));
    expect(shopTime('2026-10-20')).toEqual(new Date('2026-10-20T05:00:00Z'));
  });

  it('rejects impossible dates', () => {
    expect(shopTime('2026-02-31')).toBeNull();
    expect(shopTime('abcd-ef-gh')).toBeNull();
  });
});
