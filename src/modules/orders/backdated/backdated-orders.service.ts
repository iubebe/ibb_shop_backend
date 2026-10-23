import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { DiningTable } from '../../../database/entities/dining-table.entity.js';
import { OrderItem } from '../../../database/entities/order-item.entity.js';
import { Order } from '../../../database/entities/order.entity.js';
import { Product } from '../../../database/entities/product.entity.js';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../../../database/enums.js';
import { DEFAULT_ORDER_TIME, SHOP_UTC_OFFSET } from './backdated-orders.constants.js';

export interface BackdatedLine {
  productId: string;
  quantity: number;
  notes: string | null;
}

export interface BackdatedDraft {
  tableId: string;
  orderedAt: Date;
  paymentMethod: PaymentMethod;
  lines: BackdatedLine[];
}

export interface BackdatedOrderSummary {
  id: string;
  tableName: string;
  orderedAt: Date;
  itemCount: number;
  total: number;
}

/** `YYYY-MM-DD` + `HH:mm` in shop time -> instant. Returns null if it is not a real date. */
export function shopTime(day: string, time = DEFAULT_ORDER_TIME): Date | null {
  const date = new Date(`${day}T${time}:00${SHOP_UTC_OFFSET}`);
  if (Number.isNaN(date.getTime())) return null;
  // `2026-02-31` rolls over to March; reject it instead of silently shifting the day.
  const roundTrip = new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  return roundTrip === day ? date : null;
}

/**
 * Records orders that already happened: paid, fully served, and stamped with the
 * given time, so dashboards, finance and order history count them on that day.
 * Prices come from the current menu (there is no price history).
 */
@Injectable()
export class BackdatedOrdersService {
  constructor(private readonly dataSource: DataSource) {}

  async createMany(
    branchId: string,
    userId: string,
    drafts: BackdatedDraft[],
    /** Join an open transaction (the Excel import) instead of starting one. */
    outer?: EntityManager,
  ): Promise<BackdatedOrderSummary[]> {
    const now = new Date();
    if (drafts.some((d) => d.orderedAt.getTime() > now.getTime())) {
      throw new BadRequestException('Order time cannot be in the future');
    }

    const run = async (manager: EntityManager) => {
      const tableIds = [...new Set(drafts.map((d) => d.tableId))];
      const productIds = [...new Set(drafts.flatMap((d) => d.lines.map((l) => l.productId)))];
      const [tables, products] = await Promise.all([
        manager.find(DiningTable, { where: { id: In(tableIds), branchId } }),
        manager.find(Product, { where: { id: In(productIds), branchId, isActive: true } }),
      ]);
      if (tables.length !== tableIds.length) throw new BadRequestException('Some tables were not found');
      if (products.length !== productIds.length) {
        throw new BadRequestException('Some products are not available');
      }
      const tableName = new Map(tables.map((t) => [t.id, t.name]));
      const price = new Map(products.map((p) => [p.id, p.price]));

      const merged = drafts.map((d) => mergeLines(d.lines));
      const totals = merged.map((lines) =>
        lines.reduce((sum, l) => sum + price.get(l.productId)! * l.quantity, 0),
      );

      const saved = await manager.save(
        drafts.map((d, i) =>
          manager.create(Order, {
            branchId,
            tableId: d.tableId,
            createdByUserId: userId,
            status: OrderStatus.PAID,
            paymentStatus: PaymentStatus.PAID,
            paymentMethod: d.paymentMethod,
            confirmedAt: d.orderedAt,
            paidAt: d.orderedAt,
            createdAt: d.orderedAt,
            updatedAt: d.orderedAt,
            total: totals[i],
          }),
        ),
      );

      await manager.save(
        saved.flatMap((order, i) =>
          merged[i].map((line) =>
            manager.create(OrderItem, {
              orderId: order.id,
              productId: line.productId,
              quantity: line.quantity,
              servedQuantity: line.quantity,
              unitPrice: price.get(line.productId)!,
              notes: line.notes,
            }),
          ),
        ),
      );

      return saved.map((order, i) => ({
        id: order.id,
        tableName: tableName.get(order.tableId!)!,
        orderedAt: drafts[i].orderedAt,
        itemCount: merged[i].length,
        total: totals[i],
      }));
    };
    return outer ? run(outer) : this.dataSource.transaction(run);
  }
}

/** Same product on several lines becomes one line, as in a manual order. */
function mergeLines(lines: BackdatedLine[]): BackdatedLine[] {
  const byProduct = new Map<string, { quantity: number; notes: string[] }>();
  for (const line of lines) {
    const entry = byProduct.get(line.productId) ?? { quantity: 0, notes: [] };
    entry.quantity += line.quantity;
    if (line.notes) entry.notes.push(line.notes);
    byProduct.set(line.productId, entry);
  }
  return [...byProduct].map(([productId, e]) => ({
    productId,
    quantity: e.quantity,
    notes: e.notes.join('; ') || null,
  }));
}
