import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  ORDER_IMPORT_COLUMNS,
  ORDER_IMPORT_MAX_ITEMS_PER_ORDER,
  ORDER_IMPORT_MAX_ROWS,
} from './order-import.constants.js';

export interface OrderImportRow {
  rowNumber: number;
  orderKey: string;
  table: string;
  product: string;
  quantity: number;
  notes: string | null;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ParsedOrderImport {
  rows: OrderImportRow[];
  errors: ImportRowError[];
}

const COLUMN_ORDER = [
  ORDER_IMPORT_COLUMNS.orderKey,
  ORDER_IMPORT_COLUMNS.table,
  ORDER_IMPORT_COLUMNS.product,
  ORDER_IMPORT_COLUMNS.quantity,
  ORDER_IMPORT_COLUMNS.notes,
];

const NOTES_MAX_LENGTH = 200;
const ORDER_KEY_MAX_LENGTH = 50;

/**
 * Reads the first sheet of an uploaded workbook. File-level problems (not a
 * workbook, wrong header, too many rows) throw; row-level problems are
 * collected so the user can fix them all in one pass.
 */
export async function parseOrderImportFile(
  buffer: Buffer,
): Promise<ParsedOrderImport> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as never);
  } catch {
    throw new BadRequestException('File is not a valid .xlsx workbook');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new BadRequestException('Workbook has no sheets');

  const columns = readHeader(sheet);
  if (sheet.rowCount - 1 > ORDER_IMPORT_MAX_ROWS) {
    throw new BadRequestException(
      `File has more than ${ORDER_IMPORT_MAX_ROWS} data rows`,
    );
  }

  const rows: OrderImportRow[] = [];
  const errors: ImportRowError[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const sheetRow = sheet.getRow(rowNumber);
    const cell = (name: string) => cellText(sheetRow, columns[name]);
    const values = COLUMN_ORDER.map((name) => cell(name));
    if (values.every((v) => v === '')) continue;

    const problems = validateRow(cell);
    if (problems.length > 0) {
      for (const message of problems) errors.push({ row: rowNumber, message });
      continue;
    }
    rows.push({
      rowNumber,
      orderKey: cell(ORDER_IMPORT_COLUMNS.orderKey),
      table: cell(ORDER_IMPORT_COLUMNS.table),
      product: cell(ORDER_IMPORT_COLUMNS.product),
      quantity: Number(cell(ORDER_IMPORT_COLUMNS.quantity)),
      notes: cell(ORDER_IMPORT_COLUMNS.notes) || null,
    });
  }
  return { rows, errors };
}

/** Workbook with the header row, plus reference sheets listing the branch's tables and products. */
export async function buildOrderImportTemplate(reference: {
  tables: string[];
  products: string[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('Đơn hàng');
  sheet.columns = [
    { header: ORDER_IMPORT_COLUMNS.orderKey, key: 'orderKey', width: 16 },
    { header: ORDER_IMPORT_COLUMNS.table, key: 'table', width: 16 },
    { header: ORDER_IMPORT_COLUMNS.product, key: 'product', width: 30 },
    { header: ORDER_IMPORT_COLUMNS.quantity, key: 'quantity', width: 12 },
    { header: ORDER_IMPORT_COLUMNS.notes, key: 'notes', width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const guide = workbook.addWorksheet('Hướng dẫn');
  guide.columns = [{ key: 'text', width: 100 }];
  const guideLines = [
    'Mỗi dòng là một món trong đơn. Các dòng có cùng "Mã đơn" sẽ thành một đơn.',
    'Các dòng của cùng một đơn phải có cùng "Bàn".',
    'Bàn và Món phải đúng tên như ở sheet "Bàn" và "Món". Món phải đang được bán.',
    `"Số lượng" là số nguyên từ 1 đến 99. Mỗi đơn tối đa ${ORDER_IMPORT_MAX_ITEMS_PER_ORDER} dòng.`,
    '"Ghi chú" không bắt buộc, tối đa 200 ký tự.',
    'Nếu có dòng lỗi, toàn bộ file sẽ không được nhập và hệ thống báo số dòng lỗi.',
  ];
  for (const line of guideLines) guide.addRow({ text: line });

  const tables = workbook.addWorksheet('Bàn');
  tables.columns = [{ header: 'Tên bàn', key: 'name', width: 24 }];
  tables.getRow(1).font = { bold: true };
  for (const name of reference.tables) tables.addRow({ name });

  const products = workbook.addWorksheet('Món');
  products.columns = [{ header: 'Tên món', key: 'name', width: 40 }];
  products.getRow(1).font = { bold: true };
  for (const name of reference.products) products.addRow({ name });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function readHeader(sheet: ExcelJS.Worksheet): Record<string, number> {
  const header = sheet.getRow(1);
  const index: Record<string, number> = {};
  header.eachCell((cell, colNumber) => {
    const label = String(cell.text ?? '').trim();
    if (label) index[label] = colNumber;
  });
  const missing = COLUMN_ORDER.filter((name) => !(name in index));
  if (missing.length > 0) {
    throw new BadRequestException(
      `Missing column(s) in row 1: ${missing.join(', ')}`,
    );
  }
  return index;
}

function cellText(row: ExcelJS.Row, column: number): string {
  return String(row.getCell(column).text ?? '').trim();
}

function validateRow(cell: (name: string) => string): string[] {
  const problems: string[] = [];
  const orderKey = cell(ORDER_IMPORT_COLUMNS.orderKey);
  const table = cell(ORDER_IMPORT_COLUMNS.table);
  const product = cell(ORDER_IMPORT_COLUMNS.product);
  const quantity = cell(ORDER_IMPORT_COLUMNS.quantity);
  const notes = cell(ORDER_IMPORT_COLUMNS.notes);

  if (!orderKey) problems.push('Thiếu mã đơn');
  else if (orderKey.length > ORDER_KEY_MAX_LENGTH)
    problems.push(`Mã đơn tối đa ${ORDER_KEY_MAX_LENGTH} ký tự`);
  if (!table) problems.push('Thiếu bàn');
  if (!product) problems.push('Thiếu món');
  if (!/^\d+$/.test(quantity)) {
    problems.push('Số lượng phải là số nguyên');
  } else if (Number(quantity) < 1 || Number(quantity) > 99) {
    problems.push('Số lượng phải từ 1 đến 99');
  }
  if (notes.length > NOTES_MAX_LENGTH)
    problems.push(`Ghi chú tối đa ${NOTES_MAX_LENGTH} ký tự`);
  return problems;
}
