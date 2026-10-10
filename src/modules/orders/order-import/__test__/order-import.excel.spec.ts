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
      { rowNumber: 2, orderKey: 'DH1', table: 'Bàn 1', product: 'Phở bò', quantity: 2, notes: 'ít hành' },
      { rowNumber: 4, orderKey: 'DH1', table: 'Bàn 1', product: 'Trà đá', quantity: 1, notes: null },
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
    expect(orders.getRow(1).values).toEqual([undefined, ...HEADER]);
    expect(orders.rowCount).toBe(1);
    expect(wb.getWorksheet('Bàn')!.getColumn(1).values).toEqual([undefined, 'Tên bàn', 'Bàn 1', 'Bàn 2']);
    expect(wb.getWorksheet('Món')!.getColumn(1).values).toEqual([undefined, 'Tên món', 'Phở bò']);

    // The template itself must import cleanly: header only, no data rows.
    expect(await parseOrderImportFile(buffer)).toEqual({ rows: [], errors: [] });
  });
});
