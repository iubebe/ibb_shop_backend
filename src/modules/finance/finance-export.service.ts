import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ExpenseCategory, OrderStatus } from '../../database/enums.js';
import { assertDay, assertRange } from './finance-dates.js';
import type { FinanceExport } from './finance.types.js';

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
/** Export range limit: three years of daily rows is ~1100 small objects. */
export const MAX_EXPORT_DAYS = 1100;
/** Roster shown beyond `to`, so the model can price upcoming salary. */
const ROSTER_AHEAD_DAYS = 60;

/** `$2`/`$3` are `[from, to)` days; `$4` is the timezone. */
const START = `($2::date)::timestamp AT TIME ZONE $4`;
const END = `($3::date)::timestamp AT TIME ZONE $4`;

const DAILY_SQL = `
  WITH days AS (
    SELECT d::date AS day FROM generate_series($2::date, $3::date - 1, interval '1 day') d
  ),
  rev AS (
    SELECT (o."paidAt" AT TIME ZONE $4)::date AS day, SUM(o.total) AS v, COUNT(*) AS n
    FROM orders o
    WHERE o."branchId" = $1 AND o.status = $5
      AND o."paidAt" >= ${START} AND o."paidAt" < ${END}
    GROUP BY 1
  ),
  imp AS (
    SELECT (r."importedAt" AT TIME ZONE $4)::date AS day, SUM(r."totalCost") AS v
    FROM import_receipts r
    WHERE r."branchId" = $1 AND r."importedAt" >= ${START} AND r."importedAt" < ${END}
    GROUP BY 1
  ),
  sal AS (
    SELECT (a."checkInAt" AT TIME ZONE $4)::date AS day,
           SUM(EXTRACT(EPOCH FROM (a."checkOutAt" - a."checkInAt")) / 3600) AS hours,
           SUM(EXTRACT(EPOCH FROM (a."checkOutAt" - a."checkInAt")) / 3600
               * COALESCE(u."hourlyRate", 0)) AS cost
    FROM attendance_records a JOIN users u ON u.id = a."userId"
    WHERE a."branchId" = $1 AND a."checkOutAt" IS NOT NULL
      AND a."checkInAt" >= ${START} AND a."checkInAt" < ${END}
    GROUP BY 1
  )
  SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
         EXTRACT(ISODOW FROM days.day)::int AS dow,
         COALESCE(rev.v, 0)::float8 AS revenue,
         COALESCE(rev.n, 0)::int AS orders,
         COALESCE(imp.v, 0)::float8 AS "importCost",
         ROUND(COALESCE(sal.cost, 0))::float8 AS "salaryCost",
         ROUND(COALESCE(sal.hours, 0)::numeric, 2)::float8 AS "hoursWorked"
  FROM days
  LEFT JOIN rev ON rev.day = days.day
  LEFT JOIN imp ON imp.day = days.day
  LEFT JOIN sal ON sal.day = days.day
  ORDER BY days.day`;

const EXPENSES_SQL = `
  SELECT to_char(e."incurredOn", 'YYYY-MM-DD') AS date, e.category,
         SUM(e.amount)::float8 AS amount
  FROM expenses e
  WHERE e."branchId" = $1 AND e."incurredOn" >= $2::date AND e."incurredOn" < $3::date
  GROUP BY 1, 2`;

const STOCK_ITEMS_SQL = `
  SELECT id, name, kind, unit, quantity::float8 AS quantity,
         "lowStockThreshold"::float8 AS "lowStockThreshold",
         "lastUnitCost"::float8 AS "lastUnitCost", "isActive"
  FROM stock_items WHERE "branchId" = $1 ORDER BY name`;

const IMPORT_LINES_SQL = `
  SELECT to_char(r."importedAt" AT TIME ZONE $4, 'YYYY-MM-DD') AS date,
         l."stockItemId", l.quantity::float8 AS quantity, l."unitCost"::float8 AS "unitCost"
  FROM import_receipt_lines l JOIN import_receipts r ON r.id = l."receiptId"
  WHERE r."branchId" = $1 AND r."importedAt" >= ${START} AND r."importedAt" < ${END}
  ORDER BY r."importedAt"`;

const ADJUSTMENTS_SQL = `
  SELECT to_char(m."createdAt" AT TIME ZONE $4, 'YYYY-MM-DD') AS date,
         m."stockItemId", SUM(m.change)::float8 AS change
  FROM stock_item_movements m JOIN stock_items i ON i.id = m."stockItemId"
  WHERE i."branchId" = $1 AND m.reason = 'adjustment'
    AND m."createdAt" >= ${START} AND m."createdAt" < ${END}
  GROUP BY 1, 2 ORDER BY 1`;

/** Shifts assigned to a person (approved), with hours and the person's rate. */
const ROSTER_SQL = `
  SELECT to_char(s."weekStartDate" + (s."dayOfWeek" - 1), 'YYYY-MM-DD') AS date,
         s."assignedToUserId" AS "userId", s."startTime", s."endTime",
         u."hourlyRate"::float8 AS "hourlyRate"
  FROM staff_schedules s JOIN users u ON u.id = s."assignedToUserId"
  WHERE s."branchId" = $1 AND s."assignedToUserId" IS NOT NULL
    AND s.status NOT IN ('cancelled', 'rejected', 'proposed', 'no-show')
    AND s."weekStartDate" + (s."dayOfWeek" - 1) >= $2::date
    AND s."weekStartDate" + (s."dayOfWeek" - 1) < $3::date
  ORDER BY 1`;

function shiftHours(start: string, end: string): number {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let minutes = toMin(end) - toMin(start);
  if (minutes <= 0) minutes += 24 * 60; // overnight shift
  return Math.round((minutes / 60) * 100) / 100;
}

/** Read-only dataset for the external forecasting model. */
@Injectable()
export class FinanceExportService {
  private readonly timezone: string;
  private readonly configuredBranch: string | undefined;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.timezone = config.get<string>('SHOP_TIMEZONE') || DEFAULT_TIMEZONE;
    this.configuredBranch = config.get<string>('FORECAST_BRANCH_ID') || undefined;
  }

  /** `FORECAST_BRANCH_ID`, or the only branch when there is exactly one. */
  async resolveBranch(): Promise<string> {
    if (this.configuredBranch) return this.configuredBranch;
    const rows = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM branches LIMIT 2`,
    );
    if (rows.length !== 1) {
      throw new BadRequestException(
        'Set FORECAST_BRANCH_ID: the system does not have exactly one branch',
      );
    }
    return rows[0].id;
  }

  async export(from: string, to: string): Promise<FinanceExport> {
    assertRange(from, to, MAX_EXPORT_DAYS);
    const branchId = await this.resolveBranch();
    const args = [branchId, from, to, this.timezone, OrderStatus.PAID];
    const base = args.slice(0, 4);
    const today = await this.today();
    assertDay(today);
    const rosterTo = this.addDays(today, ROSTER_AHEAD_DAYS);

    const [daily, expenses, items, importLines, adjustments, roster] =
      await Promise.all([
        this.dataSource.query<FinanceExport['daily']>(DAILY_SQL, args),
        this.dataSource.query<
          { date: string; category: ExpenseCategory; amount: number }[]
        >(EXPENSES_SQL, [branchId, from, to]),
        this.dataSource.query<FinanceExport['stockItems']>(STOCK_ITEMS_SQL, [
          branchId,
        ]),
        this.dataSource.query<FinanceExport['importLines']>(
          IMPORT_LINES_SQL,
          base,
        ),
        this.dataSource.query<FinanceExport['stockAdjustments']>(
          ADJUSTMENTS_SQL,
          base,
        ),
        this.dataSource.query<
          {
            date: string;
            userId: string;
            startTime: string;
            endTime: string;
            hourlyRate: number | null;
          }[]
        >(ROSTER_SQL, [branchId, from, rosterTo > to ? rosterTo : to]),
      ]);

    const categories = Object.values(ExpenseCategory);
    const rows = daily.map((d) => ({
      ...d,
      expenses: Object.fromEntries(categories.map((c) => [c, 0])) as Record<
        ExpenseCategory,
        number
      >,
      operatingCost: 0,
      partial: d.date >= today,
    }));
    const rowByDate = new Map(rows.map((r) => [r.date, r]));
    for (const e of expenses) {
      const row = rowByDate.get(e.date);
      if (!row) continue;
      row.expenses[e.category] += e.amount;
      row.operatingCost += e.amount;
    }

    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      timezone: this.timezone,
      currency: 'VND',
      from,
      to,
      today,
      daily: rows,
      stockItems: items,
      importLines,
      stockAdjustments: adjustments,
      roster: roster.map((r) => ({
        date: r.date,
        userId: r.userId,
        hours: shiftHours(r.startTime, r.endTime),
        hourlyRate: r.hourlyRate,
      })),
    };
  }

  private async today(): Promise<string> {
    const rows = await this.dataSource.query<{ d: string }[]>(
      `SELECT to_char(now() AT TIME ZONE $1, 'YYYY-MM-DD') AS d`,
      [this.timezone],
    );
    return rows[0].d;
  }

  private addDays(day: string, days: number): string {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
