import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GuestService } from '../guest.service.js';

const table = { id: 't1', branchId: 'b1', name: 'Bàn 1', qrToken: 'tok' };
const product = (id: string, price: number) => ({
  id,
  price,
  name: `P${id}`,
});

function build(opts: { table?: unknown; products?: unknown[] } = {}) {
  const tables = {
    findOneBy: vi.fn().mockResolvedValue('table' in opts ? opts.table : table),
  };
  const manager = {
    find: vi.fn().mockResolvedValue(opts.products ?? []),
    create: vi.fn((_: unknown, data: object) => ({ ...data })),
    save: vi.fn(async (x: unknown) =>
      Array.isArray(x) ? x : { id: 'o1', ...(x as object) },
    ),
  };
  const dataSource = {
    transaction: vi.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const service = new GuestService(
    tables as never,
    {} as never,
    {} as never,
    {} as never,
    dataSource as never,
  );
  return { service, manager };
}

describe('GuestService', () => {
  it('404s on an unknown qrToken', async () => {
    const { service } = build({ table: null });
    await expect(service.getTable('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('prices the order from the database and merges duplicate lines', async () => {
    const { service, manager } = build({
      products: [product('a', 30_000), product('b', 10_000)],
    });
    const order = await service.createOrder('tok', {
      items: [
        { productId: 'a', quantity: 1, notes: 'ít đá' },
        { productId: 'a', quantity: 2 },
        { productId: 'b', quantity: 1 },
      ],
    });
    expect(order.total).toBe(100_000);
    expect(order.status).toBe('pending_confirmation');
    expect(order.items).toHaveLength(2);
    expect(order.items[0]).toMatchObject({ quantity: 3, notes: 'ít đá' });
    expect(manager.find).toHaveBeenCalledOnce();
  });

  it('rejects products that are missing, inactive or from another branch', async () => {
    const { service } = build({ products: [product('a', 1)] });
    await expect(
      service.createOrder('tok', {
        items: [
          { productId: 'a', quantity: 1 },
          { productId: 'gone', quantity: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
