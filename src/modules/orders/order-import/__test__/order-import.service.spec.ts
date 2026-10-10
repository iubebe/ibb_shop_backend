import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { OrderStatus } from '../../../../database/enums.js';
import { OrderImportService } from '../order-import.service.js';

const HEADER = ['Mã đơn', 'Bàn', 'Món', 'Số lượng', 'Ghi chú'];

async function xlsx(rows: (string | number | null)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Đơn hàng');
  sheet.addRow(HEADER);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const tables = [
  { id: 't1', name: 'Bàn 1', branchId: 'b1' },
  { id: 't2', name: 'Bàn 2', branchId: 'b1' },
];
const products = [
  { id: 'p1', name: 'Phở bò', price: 50000, isActive: true, branchId: 'b1' },
  { id: 'p2', name: 'Trà đá', price: 5000, isActive: true, branchId: 'b1' },
];

function build() {
  let savedOrders: any[] = [];
  let savedItems: any[] = [];
  let nextId = 1;
  const manager = {
    create: vi.fn((_entity: unknown, data: unknown) => ({ ...(data as object) })),
    save: vi.fn(async (data: unknown) => {
      if (!Array.isArray(data)) return data;
      const withIds = data.map((d: any) => (d.orderId === undefined ? { ...d, id: `o${nextId++}` } : d));
      if (data.length && (data[0] as any).orderId === undefined) savedOrders = withIds;
      else savedItems = withIds;
      return withIds;
    }),
  };
  const dataSource = {
    transaction: vi.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const tableRepo = { find: vi.fn().mockResolvedValue(tables) };
  const productRepo = { find: vi.fn().mockResolvedValue(products) };
  const service = new OrderImportService(tableRepo as never, productRepo as never, dataSource as never);
  return {
    service,
    manager,
    tableRepo,
    productRepo,
    get savedOrders() {
      return savedOrders;
    },
    get savedItems() {
      return savedItems;
    },
  };
}

describe('OrderImportService.import', () => {
  it('creates one confirmed order per order key with merged lines and computed totals', async () => {
    const ctx = build();
    const file = await xlsx([
      ['DH1', 'Bàn 1', 'Phở bò', 2, 'ít hành'],
      ['DH1', 'Bàn 1', 'Trà đá', 1, null],
      ['DH1', 'Bàn 1', 'Phở bò', 1, 'nhiều rau'],
      ['DH2', 'Bàn 2', 'Trà đá', 3, null],
    ]);

    const result = await ctx.service.import('b1', 'u1', file);

    expect(result.created).toBe(2);
    expect(result.orders).toEqual([
      { id: 'o1', orderKey: 'DH1', tableName: 'Bàn 1', itemCount: 2, total: 155000 },
      { id: 'o2', orderKey: 'DH2', tableName: 'Bàn 2', itemCount: 1, total: 15000 },
    ]);
    expect(ctx.savedOrders[0]).toMatchObject({
      branchId: 'b1',
      tableId: 't1',
      createdByUserId: 'u1',
      status: OrderStatus.CONFIRMED,
      total: 155000,
    });
    const dh1Items = ctx.savedItems.filter((i) => i.orderId === 'o1');
    expect(dh1Items).toEqual([
      expect.objectContaining({ productId: 'p1', quantity: 3, unitPrice: 50000, notes: 'ít hành; nhiều rau' }),
      expect.objectContaining({ productId: 'p2', quantity: 1, unitPrice: 5000, notes: null }),
    ]);
  });

  it('rejects the whole file with every row error and writes nothing', async () => {
    const ctx = build();
    const file = await xlsx([
      ['DH1', 'Bàn 9', 'Phở bò', 1, null],
      ['DH2', 'Bàn 1', 'Mì xào', 1, null],
      ['DH3', 'Bàn 1', 'Phở bò', 1, null],
      ['DH3', 'Bàn 2', 'Trà đá', 1, null],
    ]);

    const error = await ctx.service.import('b1', 'u1', file).catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual({
      message: 'Order file has errors; nothing was imported',
      errorCount: 3,
      errors: [
        { row: 2, message: 'Table not found: "Bàn 9"' },
        { row: 3, message: 'Product not found or inactive: "Mì xào"' },
        { row: 5, message: 'Order "DH3" must use one table (expected "Bàn 1")' },
      ],
    });
    expect(ctx.manager.save).not.toHaveBeenCalled();
  });

  it('matches table and product names ignoring case and extra spaces', async () => {
    const ctx = build();
    const file = await xlsx([['DH1', '  bàn   1 ', 'PHỞ BÒ', 1, null]]);

    const result = await ctx.service.import('b1', 'u1', file);

    expect(result.created).toBe(1);
    expect(ctx.savedItems[0]).toMatchObject({ productId: 'p1' });
  });

  it('rejects a name that is shared by two items in the branch', async () => {
    const ctx = build();
    ctx.productRepo.find.mockResolvedValue([
      ...products,
      { id: 'p3', name: 'Phở bò', price: 60000, isActive: true, branchId: 'b1' },
    ]);
    const file = await xlsx([['DH1', 'Bàn 1', 'Phở bò', 1, null]]);

    const error = await ctx.service.import('b1', 'u1', file).catch((e) => e);

    expect(error.getResponse().errors).toEqual([
      { row: 2, message: 'Product name is not unique: "Phở bò"' },
    ]);
    expect(ctx.manager.save).not.toHaveBeenCalled();
  });

  it('rejects an order with more than 50 lines', async () => {
    const ctx = build();
    const rows = Array.from({ length: 51 }, () => ['DH1', 'Bàn 1', 'Phở bò', 1, null]);

    const error = await ctx.service.import('b1', 'u1', await xlsx(rows)).catch((e) => e);

    expect(error.getResponse().errors).toEqual([
      { row: 52, message: 'Order "DH1" has more than 50 lines' },
    ]);
  });

  it('queries only the caller branch', async () => {
    const ctx = build();
    await ctx.service.import('b1', 'u1', await xlsx([['DH1', 'Bàn 1', 'Phở bò', 1, null]]));

    expect(ctx.tableRepo.find).toHaveBeenCalledWith({ where: { branchId: 'b1' } });
    expect(ctx.productRepo.find).toHaveBeenCalledWith({ where: { branchId: 'b1', isActive: true } });
  });
});
