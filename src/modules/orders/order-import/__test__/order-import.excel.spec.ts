import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  buildOrderImportTemplate,
  parseOrderImportFile,
} from '../order-import.excel.js';

const HEADER = ['Mã đơn', 'Bàn', 'Món', 'Số lượng', 'Ghi chú'];

async function workbook(rows: (string | number | null)[][], header: string[] = HEADER): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Đơn hàng');
  sheet.addRow(header);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('parseOrderImportFile', () => {
  it('reads data rows and skips blank lines', async () => {
    const buffer = await workbook([
      ['DH1', 'Bàn 1', 'Phở bò', 2, 'ít hành'],
      [null, null, null, null, null],
      ['DH1', 'Bàn 1', 'Trà đá', '1', null],
    ]);

    const result = await parseOrderImportFile(buffer);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { rowNumber: 2, orderKey: 'DH1', table: 'Bàn 1', product: 'Phở bò', quantity: 2, notes: 'ít hành', orderedAt: null, paymentMethod: null },
      { rowNumber: 4, orderKey: 'DH1', table: 'Bàn 1', product: 'Trà đá', quantity: 1, notes: null, orderedAt: null, paymentMethod: null },
    ]);
  });

  it('collects row errors with row numbers instead of stopping at the first', async () => {
    const buffer = await workbook([
      ['', 'Bàn 1', 'Phở bò', 1, null],
      ['DH2', 'Bàn 2', 'Trà đá', 0, null],
      ['DH2', 'Bàn 2', 'Trà đá', 1.5, null],
      ['DH3', 'Bàn 3', '', 100, null],
    ]);

    const result = await parseOrderImportFile(buffer);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      { row: 2, message: 'Thiếu mã đơn' },
      { row: 3, message: 'Số lượng phải từ 1 đến 99' },
      { row: 4, message: 'Số lượng phải là số nguyên' },
      { row: 5, message: 'Thiếu món' },
      { row: 5, message: 'Số lượng phải từ 1 đến 99' },
    ]);
  });

  it('rejects a file whose header is missing a column', async () => {
    const buffer = await workbook([], ['Mã đơn', 'Bàn', 'Món', 'Số lượng']);

    await expect(parseOrderImportFile(buffer)).rejects.toThrow(BadRequestException);
    await expect(parseOrderImportFile(buffer)).rejects.toThrow('Ghi chú');
  });

  it('rejects bytes that are not a workbook', async () => {
    await expect(parseOrderImportFile(Buffer.from('not an xlsx'))).rejects.toThrow(
      'not a valid .xlsx workbook',
    );
  });
});

describe('buildOrderImportTemplate', () => {
  it('writes the header row and copies reference names into their sheets', async () => {
    const buffer = await buildOrderImportTemplate({
      tables: ['Bàn 1', 'Bàn 2'],
      products: ['Phở bò'],
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as never);
    const orders = wb.getWorksheet('Đơn hàng')!;
    expect(orders.getRow(1).values).toEqual([undefined, ...HEADER, 'Ngày', 'Thanh toán']);
    expect(orders.rowCount).toBe(1);
    expect(wb.getWorksheet('Bàn')!.getColumn(1).values).toEqual([undefined, 'Tên bàn', 'Bàn 1', 'Bàn 2']);
    expect(wb.getWorksheet('Món')!.getColumn(1).values).toEqual([undefined, 'Tên món', 'Phở bò']);

    // The template itself must import cleanly: header only, no data rows.
    expect(await parseOrderImportFile(buffer)).toEqual({ rows: [], errors: [] });
  });
});

describe('parseOrderImportFile date and payment columns', () => {
  const HEADER_WITH_DATE = [...HEADER, 'Ngày', 'Thanh toán'];

  it('reads text dates as shop time, defaulting to 12:00 and cash', async () => {
    const result = await parseOrderImportFile(
      await workbook(
        [
          ['A', 'Bàn 1', 'Phở bò', 1, null, '05/03/2026', null],
          ['B', 'Bàn 1', 'Phở bò', 1, null, '2026-03-05 08:15', 'chuyển khoản'],
        ],
        HEADER_WITH_DATE,
      ),
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0].orderedAt).toEqual(new Date('2026-03-05T12:00:00+07:00'));
    expect(result.rows[0].paymentMethod).toBe('cash');
    expect(result.rows[1].orderedAt).toEqual(new Date('2026-03-05T08:15:00+07:00'));
    expect(result.rows[1].paymentMethod).toBe('qr_manual');
  });

  it('reads a real Excel date cell', async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Đơn hàng');
    sheet.addRow(HEADER_WITH_DATE);
    sheet.addRow(['A', 'Bàn 1', 'Phở bò', 1, null, new Date(Date.UTC(2026, 2, 5, 9, 30)), null]);
    const result = await parseOrderImportFile(Buffer.from(await wb.xlsx.writeBuffer()));

    expect(result.rows[0].orderedAt).toEqual(new Date('2026-03-05T09:30:00+07:00'));
  });

  it('flags bad dates, bad payment, and payment without a date', async () => {
    const result = await parseOrderImportFile(
      await workbook(
        [
          ['A', 'Bàn 1', 'Phở bò', 1, null, '31/02/2026', null],
          ['B', 'Bàn 1', 'Phở bò', 1, null, 'hôm qua', null],
          ['C', 'Bàn 1', 'Phở bò', 1, null, '05/03/2026', 'thẻ'],
          ['D', 'Bàn 1', 'Phở bò', 1, null, null, 'Tiền mặt'],
        ],
        HEADER_WITH_DATE,
      ),
    );

    expect(result.rows).toEqual([]);
    expect(result.errors.map((e) => e.row)).toEqual([2, 3, 4, 5]);
  });
});
