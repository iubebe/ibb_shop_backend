import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { And, DataSource, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { Expense } from '../../database/entities/expense.entity.js';
import {
  ExpenseCategory,
  OrderStatus,
  PaymentMethod,
} from '../../database/enums.js';
import type {
  ExpenseView,
  FinanceDay,
  FinanceSummary,
  SalaryLine,
} from './finance.types.js';

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const MAX_RANGE_DAYS = 366;
const MS_PER_DAY = 86_400_000;

/** `$2`/`$3` are `[from, to)` days; `$4` is the timezone. */
const RANGE_START = `($2::date)::timestamp AT TIME ZONE $4`;
const RANGE_END = `($3::date)::timestamp AT TIME ZONE $4`;

const DAILY_SQL = `
  WITH days AS (
    SELECT d::date AS day
    FROM generate_series($2::date, $3::date - 1, interval '1 day') d
  ),
  rev AS (
    SELECT (o."paidAt" AT TIME ZONE $4)::date AS day, SUM(o.total) AS v
    FROM orders o
    WHERE o."branchId" = $1 AND o.status = $5
      AND o."paidAt" >= ${RANGE_START} AND o."paidAt" < ${RANGE_END}
    GROUP BY 1
  ),
  imp AS (
    SELECT (r."importedAt" AT TIME ZONE $4)::date AS day, SUM(r."totalCost") AS v
    FROM import_receipts r
    WHERE r."branchId" = $1
      AND r.status = 'confirmed'
      AND r."importedAt" >= ${RANGE_START} AND r."importedAt" < ${RANGE_END}
    GROUP BY 1
  ),
  wo AS (
    SELECT (w."writtenOffAt" AT TIME ZONE $4)::date AS day, SUM(w."totalCost") AS v
    FROM write_offs w
    WHERE w."branchId" = $1 AND w.status = 'confirmed'
      AND w."writtenOffAt" >= ${RANGE_START} AND w."writtenOffAt" < ${RANGE_END}
    GROUP BY 1
  ),
  op AS (
    SELECT e."incurredOn" AS day, SUM(e.amount) AS v
    FROM expenses e
    WHERE e."branchId" = $1
      AND e."incurredOn" >= $2::date AND e."incurredOn" < $3::date
    GROUP BY 1
  ),
  sal AS (
    SELECT (a."checkInAt" AT TIME ZONE $4)::date AS day,
           SUM(EXTRACT(EPOCH FROM (a."checkOutAt" - a."checkInAt")) / 3600
               * u."hourlyRate") AS v
    FROM attendance_records a JOIN users u ON u.id = a."userId"
    WHERE a."branchId" = $1 AND a."checkOutAt" IS NOT NULL
      AND u."hourlyRate" IS NOT NULL
      AND a."checkInAt" >= ${RANGE_START} AND a."checkInAt" < ${RANGE_END}
    GROUP BY 1
  )
  SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
         COALESCE(rev.v, 0)::float8 AS revenue,
         COALESCE(imp.v, 0)::float8 AS "importCost",
         COALESCE(op.v, 0)::float8 AS "operatingCost",
         COALESCE(wo.v, 0)::float8 AS "writeOffLoss",
         ROUND(COALESCE(sal.v, 0))::float8 AS "salaryCost"
  FROM days
  LEFT JOIN rev ON rev.day = days.day
  LEFT JOIN imp ON imp.day = days.day
  LEFT JOIN op ON op.day = days.day
  LEFT JOIN wo ON wo.day = days.day
  LEFT JOIN sal ON sal.day = days.day
  ORDER BY days.day`;

const REVENUE_SQL = `
  SELECT o."paymentMethod" AS method, SUM(o.total)::float8 AS amount,
         COUNT(*)::int AS orders
  FROM orders o
  WHERE o."branchId" = $1 AND o.status = $5
    AND o."paidAt" >= ${RANGE_START} AND o."paidAt" < ${RANGE_END}
  GROUP BY 1
  ORDER BY amount DESC`;

const SALARY_SQL = `
  SELECT u.id AS "userId", u.name, u."hourlyRate"::float8 AS "hourlyRate",
         SUM(EXTRACT(EPOCH FROM (a."checkOutAt" - a."checkInAt")) / 3600)::float8 AS hours
  FROM attendance_records a JOIN users u ON u.id = a."userId"
  WHERE a."branchId" = $1 AND a."checkOutAt" IS NOT NULL
    AND a."checkInAt" >= ${RANGE_START} AND a."checkInAt" < ${RANGE_END}
  GROUP BY u.id
  ORDER BY u.name`;

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (rows: number[]) => rows.reduce((a, b) => a + b, 0);

/** Read-only money figures plus CRUD for operating expenses. */
@Injectable()
export class FinanceService {
  private readonly timezone: string;

  constructor(
    @InjectRepository(Expense) private readonly expenses: Repository<Expense>,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.timezone = config.get<string>('SHOP_TIMEZONE') || DEFAULT_TIMEZONE;
  }

  async summary(
    branchId: string,
    from: string,
    to: string,
  ): Promise<FinanceSummary> {
    this.assertRange(from, to);
    const args = [branchId, from, to, this.timezone, OrderStatus.PAID];
    const [daily, revenue, byCategory, salaryRows] = await Promise.all([
      this.dataSource.query<FinanceDay[]>(DAILY_SQL, args),
      this.dataSource.query<
        { method: PaymentMethod | null; amount: number; orders: number }[]
      >(REVENUE_SQL, args),
      this.dataSource.query<{ category: ExpenseCategory; amount: number }[]>(
        `SELECT category, SUM(amount)::float8 AS amount FROM expenses
         WHERE "branchId" = $1 AND "incurredOn" >= $2::date AND "incurredOn" < $3::date
         GROUP BY category ORDER BY amount DESC`,
        [branchId, from, to],
      ),
      this.dataSource.query<
        {
          userId: string;
          name: string;
          hourlyRate: number | null;
          hours: number;
        }[]
      >(SALARY_SQL, args.slice(0, 4)),
    ]);

    const salary: SalaryLine[] = salaryRows.map((row) => ({
      userId: row.userId,
      name: row.name,
      hours: round2(row.hours),
      hourlyRate: row.hourlyRate,
      amount: Math.round(row.hours * (row.hourlyRate ?? 0)),
    }));

    const importCost = sum(daily.map((d) => d.importCost));
    const operatingCost = sum(daily.map((d) => d.operatingCost));
    const writeOffLoss = sum(daily.map((d) => d.writeOffLoss));
    const salaryCost = sum(salary.map((s) => s.amount));
    const totalRevenue = sum(revenue.map((r) => r.amount));
    const totalCost = importCost + operatingCost + salaryCost;

    return {
      from,
      to,
      totals: {
        revenue: totalRevenue,
        paidOrders: sum(revenue.map((r) => r.orders)),
        importCost,
        operatingCost,
        writeOffLoss,
        salaryCost,
        totalCost,
        profit: totalRevenue - totalCost,
      },
      revenueByMethod: revenue.map(({ method, amount }) => ({ method, amount })),
      expensesByCategory: byCategory,
      salary,
      staffWithoutRate: salary.filter((s) => s.hourlyRate === null).length,
      daily,
    };
  }

  async listExpenses(
    branchId: string,
    from: string,
    to: string,
  ): Promise<ExpenseView[]> {
    this.assertRange(from, to);
    const rows = await this.expenses.find({
      where: {
        branchId,
        incurredOn: And(MoreThanOrEqual(from), LessThan(to)),
      },
      relations: { createdByUser: true },
      order: { incurredOn: 'DESC', createdAt: 'DESC' },
    });
    return rows.map(view);
  }

  async createExpense(
    branchId: string,
    userId: string,
    dto: {
      category: ExpenseCategory;
      amount: number;
      incurredOn: string;
      note?: string | null;
    },
  ): Promise<ExpenseView> {
    this.assertDay(dto.incurredOn);
    const saved = await this.expenses.save(
      this.expenses.create({
        branchId,
        category: dto.category,
        amount: dto.amount,
        incurredOn: dto.incurredOn,
        note: dto.note ?? null,
        createdByUserId: userId,
      }),
    );
    return this.getExpense(branchId, saved.id);
  }

  async updateExpense(
    branchId: string,
    id: string,
    patch: {
      category?: ExpenseCategory;
      amount?: number;
      incurredOn?: string;
      note?: string | null;
    },
  ): Promise<ExpenseView> {
    const row = await this.find(branchId, id);
    if (patch.incurredOn !== undefined) this.assertDay(patch.incurredOn);
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.amount !== undefined) row.amount = patch.amount;
    if (patch.incurredOn !== undefined) row.incurredOn = patch.incurredOn;
    if (patch.note !== undefined) row.note = patch.note;
    await this.expenses.save(row);
    return this.getExpense(branchId, id);
  }

  async removeExpense(branchId: string, id: string): Promise<void> {
    const row = await this.find(branchId, id);
    await this.expenses.remove(row);
  }

  private async getExpense(branchId: string, id: string): Promise<ExpenseView> {
    const row = await this.expenses.findOne({
      where: { id, branchId },
      relations: { createdByUser: true },
    });
    if (!row) throw new NotFoundException('Expense not found');
    return view(row);
  }

  private async find(branchId: string, id: string): Promise<Expense> {
    const row = await this.expenses.findOne({ where: { id, branchId } });
    if (!row) throw new NotFoundException('Expense not found');
    return row;
  }

  /** @throws BadRequestException unless `day` is a real calendar day. */
  assertDay(day: string) {
    const parsed = new Date(`${day}T00:00:00Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== day
    ) {
      throw new BadRequestException(`${day} is not a valid date`);
    }
  }

  assertRange(from: string, to: string) {
    this.assertDay(from);
    this.assertDay(to);
    const span = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
    if (span <= 0) throw new BadRequestException('`from` must be before `to`');
    if (span > MAX_RANGE_DAYS * MS_PER_DAY) {
      throw new BadRequestException(`Range is limited to ${MAX_RANGE_DAYS} days`);
    }
  }
}

function view(row: Expense): ExpenseView {
  return {
    id: row.id,
    category: row.category,
    amount: row.amount,
    incurredOn: row.incurredOn,
    note: row.note,
    createdByName: row.createdByUser?.name ?? null,
    createdAt: row.createdAt,
  };
}
