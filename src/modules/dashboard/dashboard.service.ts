import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity.js';
import { OrderStatus, UserRole } from '../../database/enums.js';
import type {
  DashboardQueue,
  DashboardSales,
  DashboardView,
} from './dashboard.types.js';

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const RECENT_LIMIT = 10;
const TOP_LIMIT = 5;

/** Start of the current day in the shop timezone, as a timestamptz. */
const SINCE_SQL = `date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2`;

/** Read-only figures for the SMS dashboard, scoped to the user's branch. */
@Injectable()
export class DashboardService {
  private readonly timezone: string;

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.timezone = config.get<string>('SHOP_TIMEZONE') || DEFAULT_TIMEZONE;
  }

  async get(branchId: string, role: UserRole): Promise<DashboardView> {
    const since = await this.startOfToday();
    const [queue, recentOrders, sales] = await Promise.all([
      this.queue(branchId),
      this.recentOrders(branchId, since),
      // Money figures never leave the server for staff/cashier.
      role === UserRole.ADMIN ? this.sales(branchId) : Promise.resolve(null),
    ]);
    return { since, queue, recentOrders, sales };
  }

  private async startOfToday(): Promise<Date> {
    const rows = await this.dataSource.query<{ since: Date }[]>(
      `SELECT ${SINCE_SQL.replace(/\$2/g, '$1')} AS since`,
      [this.timezone],
    );
    return rows[0].since;
  }

  private async queue(branchId: string): Promise<DashboardQueue> {
    const [counts, unserved] = await Promise.all([
      this.dataSource.query<{ status: OrderStatus; count: number }[]>(
        `SELECT status, COUNT(*)::int AS count FROM orders
         WHERE "branchId" = $1 AND status IN ($2, $3) GROUP BY status`,
        [branchId, OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED],
      ),
      this.dataSource.query<{ unserved: number }[]>(
        `SELECT COALESCE(SUM(i.quantity - i."servedQuantity"), 0)::int AS unserved
         FROM order_items i JOIN orders o ON o.id = i."orderId"
         WHERE o."branchId" = $1 AND o.status = $2`,
        [branchId, OrderStatus.CONFIRMED],
      ),
    ]);
    const countOf = (status: OrderStatus) =>
      counts.find((row) => row.status === status)?.count ?? 0;
    return {
      pendingConfirmation: countOf(OrderStatus.PENDING_CONFIRMATION),
      confirmed: countOf(OrderStatus.CONFIRMED),
      unservedItems: unserved[0]?.unserved ?? 0,
    };
  }

  private async recentOrders(branchId: string, since: Date) {
    const orders = await this.orders.find({
      where: { branchId, createdAt: MoreThanOrEqual(since) },
      relations: { table: true, items: true },
      order: { createdAt: 'DESC' },
      take: RECENT_LIMIT,
    });
    return orders.map((o) => ({
      id: o.id,
      status: o.status,
      tableName: o.table?.name ?? null,
      total: o.total,
      itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: o.createdAt,
    }));
  }

  private async sales(branchId: string): Promise<DashboardSales> {
    const since = `(${SINCE_SQL.replace(/\$2/g, '$3')})`;
    const [totals, top] = await Promise.all([
      this.dataSource.query<{ revenue: number; paid: number }[]>(
        `SELECT COALESCE(SUM(total), 0)::float8 AS revenue, COUNT(*)::int AS paid
         FROM orders WHERE "branchId" = $1 AND status = $2 AND "paidAt" >= ${since}`,
        [branchId, OrderStatus.PAID, this.timezone],
      ),
      this.dataSource.query<
        { productId: string; name: string; quantity: number; revenue: number }[]
      >(
        `SELECT p.id AS "productId", p.name AS name,
                SUM(i.quantity)::int AS quantity,
                SUM(i.quantity * i."unitPrice")::float8 AS revenue
         FROM order_items i
         JOIN orders o ON o.id = i."orderId"
         JOIN products p ON p.id = i."productId"
         WHERE o."branchId" = $1 AND o.status = $2 AND o."paidAt" >= ${since}
         GROUP BY p.id, p.name
         ORDER BY quantity DESC, p.name ASC
         LIMIT ${TOP_LIMIT}`,
        [branchId, OrderStatus.PAID, this.timezone],
      ),
    ]);
    return {
      revenue: totals[0]?.revenue ?? 0,
      paidOrders: totals[0]?.paid ?? 0,
      topProducts: top,
    };
  }
}
