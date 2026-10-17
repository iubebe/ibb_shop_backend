/** Column headers of the import sheet, in template order. */
export const ORDER_IMPORT_COLUMNS = {
  orderKey: 'Mã đơn',
  table: 'Bàn',
  product: 'Món',
  quantity: 'Số lượng',
  notes: 'Ghi chú',
} as const;

export const ORDER_IMPORT_FIELD = 'file';
export const ORDER_IMPORT_MAX_BYTES = 2 * 1_048_576;
/** Same per-order cap as a manual order (`CreateOrderStaffDto`). */
export const ORDER_IMPORT_MAX_ITEMS_PER_ORDER = 50;
export const ORDER_IMPORT_MAX_ORDERS = 200;
export const ORDER_IMPORT_MAX_ROWS = 2000;
export const ORDER_IMPORT_MAX_ERRORS = 100;

export const ORDER_IMPORT_TEMPLATE_NAME = 'order-import-template.xlsx';
export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
