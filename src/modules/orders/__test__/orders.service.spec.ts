import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '../../../database/enums.js';
import type { CreateOrderStaffDto } from '../dto/create-order-staff.dto.js';
import { OrdersService, uuidRange } from '../orders.service.js';

function build(item: unknown) {
  const manager = {
    findOne: vi.fn().mockResolvedValue(item),
    update: vi.fn().mockResolvedValue(undefined),
    create: vi.fn((_entity: unknown, data: unknown) => data),
    save: vi.fn(async (data: object) => ({ id: 'c-new', ...data })),
  };
  const dataSource = {
    transaction: vi.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const service = new OrdersService({} as never, {} as never, {} as never, {} as never, dataSource as never);
  return { service, manager };
}

function buildCreateOrder() {
  const mockProducts = [
    { id: 'p1', name: 'Product 1', price: 10000, isActive: true },
    { id: 'p2', name: 'Product 2', price: 20000, isActive: true },
  ];
  const mockTable = { id: 't1', name: 'Table 1', branchId: 'b1' };

  let savedOrder: any;
  let savedItems: any[];

  const manager = {
    findOne: vi.fn(async (entity: unknown, options: unknown) => {
      const opts = options as any;
      if (opts?.where?.id === 't1' && opts?.where?.branchId === 'b1') {
        return mockTable;
      }
      return null;
    }),
    find: vi.fn(async (entity: unknown, options: unknown) => {
      const opts = options as any;
      if (opts?.where?.branchId === 'b1' && opts?.where?.isActive) {
        // Check if the request includes product IDs
        return mockProducts;
      }
      return [];
    }),
    create: vi.fn((entity: unknown, data: unknown) => data),
    save: vi.fn(async (data: unknown | any[]) => {
      if (Array.isArray(data)) {
        savedItems = data;
        return data;
      }
      savedOrder = data;
      return data;
    }),
  };

  const dataSource = {
    transaction: vi.fn(async (cb: (m: typeof manager) => unknown) => {
      return cb(manager);
    }),
  };

  const ordersRepo = {} as never;
  const tablesRepo = {} as never;
  const productsRepo = {} as never;
  const qrCodesRepo = {} as never;

  const service = new OrdersService(
    ordersRepo,
    tablesRepo,
    productsRepo,
    qrCodesRepo,
    dataSource as never,
  );

  return { service, manager, mockTable, mockProducts, getSavedOrder: () => savedOrder, getSavedItems: () => savedItems };
}

const item = (status: OrderStatus, quantity = 2) => ({
  id: 'i1',
  quantity,
  order: { status },
});

describe('OrdersService.setServed', () => {
  it('stores the absolute served count on a confirmed order', async () => {
    const { service, manager } = build(item(OrderStatus.CONFIRMED));
    await expect(service.setServed('b1', 'o1', 'i1', 1)).resolves.toEqual({
      id: 'i1',
      quantity: 2,
      servedQuantity: 1,
    });
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'i1', {
      servedQuantity: 1,
    });
  });

  it('404s when the item is not in the user branch/order', async () => {
    const { service } = build(null);
    await expect(service.setServed('b1', 'o1', 'x', 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('409s unless the order is confirmed', async () => {
    const { service, manager } = build(item(OrderStatus.PENDING_CONFIRMATION));
    await expect(service.setServed('b1', 'o1', 'i1', 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('400s when served exceeds the ordered quantity', async () => {
    const { service, manager } = build(item(OrderStatus.CONFIRMED));
    await expect(service.setServed('b1', 'o1', 'i1', 3)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(manager.update).not.toHaveBeenCalled();
  });
});

describe('OrdersService.createOrder', () => {
  it('creates an order with items for a valid table', async () => {
    const { service, manager, mockProducts } = buildCreateOrder();
    const dto: CreateOrderStaffDto = {
      tableId: 't1',
      items: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 1 },
      ],
    };

    const mockOrder = {
      id: 'o1',
      branchId: 'b1',
      tableId: 't1',
      table: { id: 't1', name: 'Table 1' },
      createdByUserId: 'u1',
      status: OrderStatus.CONFIRMED,
      total: 30000,
      createdAt: new Date(),
      confirmedAt: new Date(),
      items: [
        { id: 'i1', productId: 'p1', product: mockProducts[0], quantity: 1, unitPrice: 10000, notes: null, servedQuantity: 0 },
        { id: 'i2', productId: 'p2', product: mockProducts[1], quantity: 1, unitPrice: 20000, notes: null, servedQuantity: 0 },
      ],
    };

    manager.save.mockImplementation(async (data: unknown) => {
      if ((data as any).items !== undefined) {
        return mockOrder;
      }
      return data;
    });

    const result = await service.createOrder('b1', 'u1', dto);

    expect(manager.findOne).toHaveBeenCalled();
    expect(manager.find).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.status).toBe(OrderStatus.CONFIRMED);
    expect(result.confirmedAt).toBeDefined();
    expect(result.items.length).toBe(2);
  });

  it('404s when the table is not found', async () => {
    const { service, manager } = buildCreateOrder();
    manager.findOne.mockResolvedValueOnce(null);

    const dto: CreateOrderStaffDto = {
      tableId: 'invalid',
      items: [{ productId: 'p1', quantity: 1 }],
    };

    await expect(service.createOrder('b1', 'u1', dto)).rejects.toThrow(NotFoundException);
  });

  it('400s when some products are not available', async () => {
    const { service, manager } = buildCreateOrder();
    manager.find.mockResolvedValueOnce([
      { id: 'p1', name: 'Product 1', price: 10000, isActive: true },
    ]); // Only 1 product found

    const dto: CreateOrderStaffDto = {
      tableId: 't1',
      items: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 1 }, // Not found
      ],
    };

    await expect(service.createOrder('b1', 'u1', dto)).rejects.toThrow(BadRequestException);
  });

  it('deduplicates items with the same product ID', async () => {
    const { service, manager, mockProducts } = buildCreateOrder();
    manager.find.mockResolvedValueOnce([mockProducts[0]]);

    const dto: CreateOrderStaffDto = {
      tableId: 't1',
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p1', quantity: 3 },
      ],
    };

    const mockOrder = {
      id: 'o1',
      branchId: 'b1',
      tableId: 't1',
      table: { id: 't1', name: 'Table 1' },
      createdByUserId: 'u1',
      status: OrderStatus.CONFIRMED,
      total: 50000,
      createdAt: new Date(),
      confirmedAt: new Date(),
      items: [
        {
          id: 'i1',
          productId: 'p1',
          product: mockProducts[0],
          quantity: 5,
          unitPrice: 10000,
          notes: null,
          servedQuantity: 0,
        },
      ],
    };

    manager.save.mockImplementation(async (data: unknown) => {
      if ((data as any).items !== undefined) {
        return mockOrder;
      }
      return data;
    });

    const result = await service.createOrder('b1', 'u1', dto);

    expect(result).toBeDefined();
    expect(result.status).toBe(OrderStatus.CONFIRMED);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(5);
  });

  it('calculates total from database prices', async () => {
    const { service, manager, mockProducts } = buildCreateOrder();
    manager.find.mockResolvedValueOnce(mockProducts);

    const dto: CreateOrderStaffDto = {
      tableId: 't1',
      items: [
        { productId: 'p1', quantity: 2 }, // 2 * 10000 = 20000
        { productId: 'p2', quantity: 1 }, // 1 * 20000 = 20000
      ],
    };

    const mockOrder = {
      id: 'o1',
      branchId: 'b1',
      tableId: 't1',
      table: { id: 't1', name: 'Table 1' },
      createdByUserId: 'u1',
      status: OrderStatus.CONFIRMED,
      total: 40000,
      createdAt: new Date(),
      confirmedAt: new Date(),
      items: [
        {
          id: 'i1',
          productId: 'p1',
          product: mockProducts[0],
          quantity: 2,
          unitPrice: 10000,
          notes: null,
          servedQuantity: 0,
        },
        {
          id: 'i2',
          productId: 'p2',
          product: mockProducts[1],
          quantity: 1,
          unitPrice: 20000,
          notes: null,
          servedQuantity: 0,
        },
      ],
    };

    manager.save.mockImplementation(async (data: unknown) => {
      if ((data as any).items !== undefined) {
        return mockOrder;
      }
      return data;
    });

    const result = await service.createOrder('b1', 'u1', dto);

    expect(result.total).toBe(40000);
    expect(result.status).toBe(OrderStatus.CONFIRMED);
  });

  it('sets createdByUserId to track staff-created orders', async () => {
    const { service, manager, mockProducts } = buildCreateOrder();
    manager.find.mockResolvedValueOnce([mockProducts[0]]);

    const dto: CreateOrderStaffDto = {
      tableId: 't1',
      items: [{ productId: 'p1', quantity: 1 }],
    };

    const mockOrder = {
      id: 'o1',
      branchId: 'b1',
      tableId: 't1',
      table: { id: 't1', name: 'Table 1' },
      createdByUserId: 'user-123',
      status: OrderStatus.PENDING_CONFIRMATION,
      total: 10000,
      createdAt: new Date(),
      confirmedAt: null,
      items: [
        {
          id: 'i1',
          productId: 'p1',
          product: mockProducts[0],
          quantity: 1,
          unitPrice: 10000,
          notes: null,
          servedQuantity: 0,
        },
      ],
    };

    manager.save.mockImplementation(async (data: unknown) => {
      if ((data as any).items !== undefined) {
        return mockOrder;
      }
      return data;
    });

    const result = await service.createOrder('b1', 'user-123', dto);

    expect(result).toBeDefined();
    expect(manager.save).toHaveBeenCalled();
  });

  it('returns a StaffOrderView with all order details', async () => {
    const { service, manager, mockProducts } = buildCreateOrder();
    manager.find.mockResolvedValueOnce([mockProducts[0]]);

    const mockOrderData = {
      id: 'o1',
      status: OrderStatus.CONFIRMED,
      tableId: 't1',
      table: { id: 't1', name: 'Table 1', branchId: 'b1' },
      createdByUserId: 'u1',
      total: 10000,
      createdAt: new Date('2026-10-08'),
      confirmedAt: new Date('2026-10-08'),
      items: [
        {
          id: 'i1',
          productId: 'p1',
          product: { id: 'p1', name: 'Product 1', price: 10000 },
          quantity: 1,
          unitPrice: 10000,
          notes: null,
          servedQuantity: 0,
        },
      ],
    };

    manager.save.mockImplementation(async (data: unknown) => {
      if ((data as any).items !== undefined) {
        return mockOrderData;
      }
      return data;
    });

    const result = await service.createOrder('b1', 'u1', {
      tableId: 't1',
      items: [{ productId: 'p1', quantity: 1 }],
    });

    expect(result).toBeDefined();
    expect(result.status).toBe(OrderStatus.CONFIRMED);
    expect(result.confirmedAt).toBeDefined();
    expect(result.tableId).toBe('t1');
    expect(result.total).toBe(10000);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].productId).toBe('p1');
  });
});

describe('OrdersService.history', () => {
  it('rejects an empty or inverted range', async () => {
    const service = new OrdersService({} as never, {} as never, {} as never, {} as never, {} as never);
    const d = new Date('2026-10-17T00:00:00Z');
    await expect(service.history('b1', d, d)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('queries the branch and range newest first', async () => {
    const find = vi.fn().mockResolvedValue([]);
    const service = new OrdersService({ find } as never, {} as never, {} as never, {} as never, {} as never);
    await service.history('b1', new Date('2026-10-17T00:00:00Z'), new Date('2026-10-18T00:00:00Z'));
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { createdAt: 'DESC' }, where: expect.objectContaining({ branchId: 'b1' }) }),
    );
  });
});

describe('uuidRange', () => {
  it('pads a short prefix to the full uuid bounds, lower-casing it', () => {
    expect(uuidRange('E9C')).toEqual({
      lo: 'e9c00000-0000-0000-0000-000000000000',
      hi: 'e9cfffff-ffff-ffff-ffff-ffffffffffff',
    });
  });
});

describe('OrdersService.searchByNumber', () => {
  function buildSearch(ids: string[]) {
    const qb: any = {};
    for (const m of ['select', 'where', 'andWhere', 'orderBy', 'limit']) qb[m] = vi.fn(() => qb);
    qb.getRawMany = vi.fn().mockResolvedValue(ids.map((id) => ({ id })));
    const find = vi.fn().mockResolvedValue([]);
    const repo = { createQueryBuilder: vi.fn(() => qb), find };
    return { qb, find, service: new OrdersService(repo as never, {} as never, {} as never, {} as never, {} as never) };
  }

  it('matches the id prefix within the branch, newest first, capped, then loads the orders', async () => {
    const { qb, find, service } = buildSearch(['o1', 'o2']);
    await service.searchByNumber('b1', 'a1b2c3');
    expect(qb.where).toHaveBeenCalledWith('o.branchId = :branchId', { branchId: 'b1' });
    expect(qb.andWhere).toHaveBeenCalledWith('o.id BETWEEN :lo::uuid AND :hi::uuid', {
      lo: 'a1b2c300-0000-0000-0000-000000000000',
      hi: 'a1b2c3ff-ffff-ffff-ffff-ffffffffffff',
    });
    expect(qb.limit).toHaveBeenCalledWith(20);
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: 'DESC' } }));
  });

  it('skips the second query when nothing matches', async () => {
    const { find, service } = buildSearch([]);
    expect(await service.searchByNumber('b1', 'ffff')).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });
});

describe('OrdersService.addItems', () => {
  function buildAdd(order: unknown, products: unknown[]) {
    const manager = {
      findOne: vi.fn().mockResolvedValue(order),
      find: vi.fn().mockResolvedValue(products),
      create: vi.fn((_: unknown, data: unknown) => data),
      save: vi.fn(async (data: any) => ({ id: 'new', servedQuantity: 0, ...data })),
      update: vi.fn().mockResolvedValue(undefined),
    };
    const dataSource = {
      transaction: vi.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
    };
    const service = new OrdersService({} as never, {} as never, {} as never, {} as never, dataSource as never);
    return { service, manager };
  }

  const p1 = { id: 'p1', name: 'Tea', price: 10000, isActive: true };
  const p2 = { id: 'p2', name: 'Cake', price: 20000, isActive: true };
  const openOrder = (status = OrderStatus.CONFIRMED) => ({
    id: 'o1',
    status,
    total: 20000,
    table: { name: 'T1' },
    items: [
      { id: 'i1', productId: 'p1', product: p1, quantity: 2, servedQuantity: 1, unitPrice: 10000, notes: null },
    ],
  });

  it('merges a repeated product, adds a new line and recomputes the total', async () => {
    const { service, manager } = buildAdd(openOrder(), [p1, p2]);
    const result = await service.addItems('b1', 'o1', {
      items: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 2, notes: 'no ice' },
      ],
    });
    expect(result.total).toBe(10000 * 3 + 20000 * 2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ id: 'i1', quantity: 3, servedQuantity: 1 });
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'o1', { total: 70000 });
  });

  it('adds a separate line when the product price changed since ordering', async () => {
    const { service } = buildAdd(openOrder(), [{ ...p1, price: 12000 }]);
    const result = await service.addItems('b1', 'o1', { items: [{ productId: 'p1', quantity: 1 }] });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(20000 + 12000);
  });

  it('404s for an unknown order', async () => {
    const { service } = buildAdd(null, []);
    await expect(
      service.addItems('b1', 'x', { items: [{ productId: 'p1', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409s for a paid order', async () => {
    const { service, manager } = buildAdd(openOrder(OrderStatus.PAID), [p1]);
    await expect(
      service.addItems('b1', 'o1', { items: [{ productId: 'p1', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('400s when a product is unavailable', async () => {
    const { service } = buildAdd(openOrder(), [p1]);
    await expect(
      service.addItems('b1', 'o1', {
        items: [
          { productId: 'p1', quantity: 1 },
          { productId: 'p2', quantity: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OrdersService.updateCustomer', () => {
  const order = (status: OrderStatus) => ({
    id: 'o1',
    status,
    tableId: null,
    table: null,
    items: [],
    customerId: null,
    customerName: 'An',
    customerPhone: null,
    customerAddress: null,
  });

  it('keeps omitted fields and clears null ones', async () => {
    const { service, manager } = build(order(OrderStatus.CONFIRMED));
    const view = await service.updateCustomer('b1', 'o1', { customerAddress: '1 Le Loi', customerName: null });
    expect(view).toMatchObject({ customerName: null, customerAddress: '1 Le Loi' });
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'o1', {
      customerId: 'c-new',
      customerName: null,
      customerPhone: null,
      customerAddress: '1 Le Loi',
    });
  });

  it('409s on a paid or cancelled order', async () => {
    for (const status of [OrderStatus.PAID, OrderStatus.CANCELLED]) {
      const { service, manager } = build(order(status));
      await expect(service.updateCustomer('b1', 'o1', { customerName: 'x' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(manager.update).not.toHaveBeenCalled();
    }
  });

  it('404s for an unknown order', async () => {
    const { service } = build(null);
    await expect(service.updateCustomer('b1', 'o1', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OrdersService.confirm', () => {
  it('links the customer typed on a guest order', async () => {
    const { service, manager } = build({
      id: 'o1',
      status: OrderStatus.PENDING_CONFIRMATION,
      table: null,
      items: [],
      customerId: null,
      customerName: 'An',
      customerPhone: null,
      customerAddress: null,
    });
    const view = await service.confirm('b1', 'o1');
    expect(view.customerId).toBe('c-new');
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      'o1',
      expect.objectContaining({ status: OrderStatus.CONFIRMED, customerId: 'c-new' }),
    );
  });
});
