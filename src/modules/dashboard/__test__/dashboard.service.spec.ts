import { OrderStatus, UserRole } from '../../../database/enums.js';
import { DashboardService } from '../dashboard.service.js';

const SINCE = new Date('2026-10-04T17:00:00Z');

function build(timezone?: string) {
  const query = vi.fn((sql: string) => {
    if (sql.includes('AS since')) return Promise.resolve([{ since: SINCE }]);
    if (sql.includes('GROUP BY status'))
      return Promise.resolve([{ status: OrderStatus.CONFIRMED, count: 3 }]);
    if (sql.includes('AS unserved')) return Promise.resolve([{ unserved: 7 }]);
    if (sql.includes('GROUP BY p.id'))
      return Promise.resolve([{ productId: 'p1', name: 'Tea', quantity: 4, revenue: 80000 }]);
    return Promise.resolve([{ revenue: 250000, paid: 5 }]);
  });
  const orders = {
    find: vi.fn().mockResolvedValue([
      {
        id: 'o1',
        status: OrderStatus.CONFIRMED,
        table: { name: 'T1' },
        total: 90000,
        createdAt: SINCE,
        items: [{ quantity: 2 }, { quantity: 1 }],
      },
      { id: 'o2', status: OrderStatus.PAID, table: null, total: 1, createdAt: SINCE, items: [] },
    ]),
  };
  const config = { get: vi.fn().mockReturnValue(timezone) };
  const service = new DashboardService(orders as never, { query } as never, config as never);
  return { service, query, orders };
}

describe('DashboardService.get', () => {
  it('returns queue, recent orders and sales for admins', async () => {
    const { service } = build();
    const view = await service.get('b1', UserRole.ADMIN);
    expect(view.since).toBe(SINCE);
    expect(view.queue).toEqual({ pendingConfirmation: 0, confirmed: 3, unservedItems: 7 });
    expect(view.recentOrders[0]).toMatchObject({ id: 'o1', tableName: 'T1', itemCount: 3 });
    expect(view.recentOrders[1]).toMatchObject({ tableName: null, itemCount: 0 });
    expect(view.sales).toEqual({
      revenue: 250000,
      paidOrders: 5,
      topProducts: [{ productId: 'p1', name: 'Tea', quantity: 4, revenue: 80000 }],
    });
  });

  it.each([UserRole.STAFF, UserRole.CASHIER])('hides sales from %s and never queries them', async (role) => {
    const { service, query } = build();
    const view = await service.get('b1', role);
    expect(view.sales).toBeNull();
    expect(query.mock.calls.some(([sql]) => /SUM\(total\)|GROUP BY p\.id/.test(sql as string))).toBe(false);
  });

  it('uses the configured shop timezone, defaulting to Asia/Ho_Chi_Minh', async () => {
    const def = build();
    await def.service.get('b1', UserRole.ADMIN);
    expect(def.query).toHaveBeenCalledWith(expect.stringContaining('AS since'), ['Asia/Ho_Chi_Minh']);
    const custom = build('Asia/Bangkok');
    await custom.service.get('b1', UserRole.ADMIN);
    expect(custom.query).toHaveBeenCalledWith(expect.stringContaining('AS since'), ['Asia/Bangkok']);
  });
});
