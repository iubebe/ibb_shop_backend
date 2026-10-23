import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DiningTable } from '../../../database/entities/dining-table.entity.js';
import { OrderItem } from '../../../database/entities/order-item.entity.js';
import { Order } from '../../../database/entities/order.entity.js';
import { Product } from '../../../database/entities/product.entity.js';
import { OrderStatus, PaymentMethod, UserRole } from '../../../database/enums.js';
import { BackdatedOrdersService } from '../backdated/backdated-orders.service.js';
import {
  ORDER_IMPORT_MAX_ERRORS,
  ORDER_IMPORT_MAX_ITEMS_PER_ORDER,
  ORDER_IMPORT_MAX_ORDERS,
} from './order-import.constants.js';
import {
  buildOrderImportTemplate,
  type ImportRowError,
  type OrderImportRow,
  parseOrderImportFile,
} from './order-import.excel.js';

export interface ImportedOrderSummary {
  id: string;
  orderKey: string;
  tableName: string;
  itemCount: number;
  total: number;
  /** Set for orders recorded in the past (paid); null for live orders. */
  orderedAt: Date | null;
}

export interface OrderImportResult {
  created: number;
  orders: ImportedOrderSummary[];
}

interface ResolvedRow {
  rowNumber: number;
  productId: string;
  productPrice: number;
  quantity: number;
  notes: string | null;
}

interface ResolvedOrder {
  orderKey: string;
  tableId: string;
  tableName: string;
  rows: ResolvedRow[];
  orderedAt: Date | null;
  paymentMethod: PaymentMethod | null;
}

/** Bulk-creates confirmed orders from an Excel sheet, all or nothing. */
@Injectable()
export class OrderImportService {
  constructor(
    @InjectRepository(DiningTable) private readonly tables: Repository<DiningTable>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly backdated: BackdatedOrdersService,
  ) {}

  /** Sheet with the header row and the branch's table and product names to copy from. */
  async template(branchId: string): Promise<Buffer> {
    const [tables, products] = await Promise.all([
      this.tables.find({ where: { branchId }, order: { name: 'ASC' } }),
      this.products.find({
        where: { branchId, isActive: true },
        order: { name: 'ASC' },
      }),
    ]);
    return buildOrderImportTemplate({
      tables: tables.map((t) => t.name),
      products: products.map((p) => p.name),
    });
  }

  /**
   * Validates every row before writing anything. If any row is wrong the whole
   * file is rejected with the list of row errors, so no partial orders are created.
   */
  async import(
    branchId: string,
    userId: string,
    role: UserRole,
    buffer: Buffer,
  ): Promise<OrderImportResult> {
    const parsed = await parseOrderImportFile(buffer);
    const errors: ImportRowError[] = [...parsed.errors];

    const groups = groupByOrderKey(parsed.rows);
    if (groups.size > ORDER_IMPORT_MAX_ORDERS) {
      throw new BadRequestException(
        `File has more than ${ORDER_IMPORT_MAX_ORDERS} orders`,
      );
    }

    const [tables, products] = await Promise.all([
      this.tables.find({ where: { branchId } }),
      this.products.find({ where: { branchId, isActive: true } }),
    ]);
    const tableByName = indexByName(tables);
    const productByName = indexByName(products);

    const orders: ResolvedOrder[] = [];
    for (const [orderKey, rows] of groups) {
      if (rows.length > ORDER_IMPORT_MAX_ITEMS_PER_ORDER) {
        errors.push({
          row: rows[ORDER_IMPORT_MAX_ITEMS_PER_ORDER].rowNumber,
          message: `Order "${orderKey}" has more than ${ORDER_IMPORT_MAX_ITEMS_PER_ORDER} lines`,
        });
      }

      const tableName = rows[0].table;
      const table = tableByName.get(normalize(tableName));
      if (table === 'ambiguous') {
        errors.push({ row: rows[0].rowNumber, message: `Table name is not unique: "${tableName}"` });
      } else if (!table) {
        errors.push({ row: rows[0].rowNumber, message: `Table not found: "${tableName}"` });
      }

      const first = rows[0];
      const resolved: ResolvedRow[] = [];
      if (first.orderedAt && role !== UserRole.ADMIN) {
        errors.push({ row: first.rowNumber, message: 'Chỉ admin được nhập đơn có ngày' });
      }
      for (const row of rows) {
        if (
          row.orderedAt?.getTime() !== first.orderedAt?.getTime() ||
          row.paymentMethod !== first.paymentMethod
        ) {
          errors.push({
            row: row.rowNumber,
            message: `Order "${orderKey}" must use the same date and payment on every line`,
          });
        }
        if (normalize(row.table) !== normalize(tableName)) {
          errors.push({
            row: row.rowNumber,
            message: `Order "${orderKey}" must use one table (expected "${tableName}")`,
          });
        }
        const product = resolveProduct(productByName, row.product);
        if (product === 'ambiguous') {
          errors.push({
            row: row.rowNumber,
            message: `Product name is not unique: "${row.product}"`,
          });
        } else if (!product) {
          errors.push({
            row: row.rowNumber,
            message: `Product not found or inactive: "${row.product}"`,
          });
        } else {
          resolved.push({
            rowNumber: row.rowNumber,
            productId: product.id,
            productPrice: product.price,
            quantity: row.quantity,
            notes: row.notes,
          });
        }
      }

      if (table && table !== 'ambiguous') {
        orders.push({
          orderKey,
          tableId: table.id,
          tableName: table.name,
          rows: resolved,
          orderedAt: first.orderedAt,
          paymentMethod: first.paymentMethod,
        });
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Order file has errors; nothing was imported',
        errorCount: errors.length,
        errors: errors.slice(0, ORDER_IMPORT_MAX_ERRORS),
      });
    }

    // Past orders and live orders are written in one transaction so a failure leaves nothing behind.
    return this.dataSource.transaction(async (manager) => {
      const live = orders.filter((o) => !o.orderedAt);
      const past = orders.filter((o) => o.orderedAt);

      const summaries = new Map<ResolvedOrder, ImportedOrderSummary>();
      if (live.length > 0) {
        const savedLive = await manager.save(
          live.map((order) =>
            manager.create(Order, {
              branchId,
              tableId: order.tableId,
              createdByUserId: userId,
              status: OrderStatus.CONFIRMED,
              confirmedAt: new Date(),
              total: sumTotal(order.rows),
            }),
          ),
        );
        await manager.save(
          savedLive.flatMap((saved, index) =>
            mergeLines(live[index].rows).map((line) =>
              manager.create(OrderItem, {
                orderId: saved.id,
                productId: line.productId,
                quantity: line.quantity,
                unitPrice: line.productPrice,
                notes: line.notes,
              }),
            ),
          ),
        );
        savedLive.forEach((saved, index) =>
          summaries.set(live[index], {
            id: saved.id,
            orderKey: live[index].orderKey,
            tableName: live[index].tableName,
            itemCount: mergeLines(live[index].rows).length,
            total: saved.total,
            orderedAt: null,
          }),
        );
      }

      if (past.length > 0) {
        const savedPast = await this.backdated.createMany(
          branchId,
          userId,
          past.map((order) => ({
            tableId: order.tableId,
            orderedAt: order.orderedAt!,
            paymentMethod: order.paymentMethod ?? PaymentMethod.CASH,
            lines: order.rows.map((r) => ({
              productId: r.productId,
              quantity: r.quantity,
              notes: r.notes,
            })),
          })),
          manager,
        );
        savedPast.forEach((saved, index) =>
          summaries.set(past[index], {
            id: saved.id,
            orderKey: past[index].orderKey,
            tableName: saved.tableName,
            itemCount: saved.itemCount,
            total: saved.total,
            orderedAt: saved.orderedAt,
          }),
        );
      }

      return { created: orders.length, orders: orders.map((o) => summaries.get(o)!) };
    });
  }
}

function groupByOrderKey(rows: OrderImportRow[]): Map<string, OrderImportRow[]> {
  const groups = new Map<string, OrderImportRow[]>();
  for (const row of rows) {
    const list = groups.get(row.orderKey) ?? [];
    list.push(row);
    groups.set(row.orderKey, list);
  }
  return groups;
}

/** Keyed by normalized name. Names that collide inside the branch are marked as `ambiguous`. */
function indexByName<T extends { name: string; id: string }>(
  items: T[],
): Map<string, T | 'ambiguous'> {
  const index = new Map<string, T | 'ambiguous'>();
  for (const item of items) {
    const key = normalize(item.name);
    index.set(key, index.has(key) ? 'ambiguous' : item);
  }
  return index;
}

function resolveProduct(
  index: Map<string, Product | 'ambiguous'>,
  name: string,
): Product | 'ambiguous' | undefined {
  return index.get(normalize(name));
}

function normalize(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

/** Same product on several lines becomes one line, as in a manual order. */
function mergeLines(rows: ResolvedRow[]) {
  const lines = new Map<
    string,
    { productId: string; productPrice: number; quantity: number; notes: string[] }
  >();
  for (const row of rows) {
    const line = lines.get(row.productId) ?? {
      productId: row.productId,
      productPrice: row.productPrice,
      quantity: 0,
      notes: [],
    };
    line.quantity += row.quantity;
    if (row.notes) line.notes.push(row.notes);
    lines.set(row.productId, line);
  }
  return [...lines.values()].map((line) => ({
    ...line,
    notes: line.notes.join('; ') || null,
  }));
}

function sumTotal(rows: ResolvedRow[]): number {
  return mergeLines(rows).reduce((sum, line) => sum + line.productPrice * line.quantity, 0);
}
