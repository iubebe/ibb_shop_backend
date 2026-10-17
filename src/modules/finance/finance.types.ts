import type { ForecastPayload } from '../../database/entities/finance-forecast.entity.js';
import type { ExpenseCategory, PaymentMethod } from '../../database/enums.js';

export interface ExpenseView {
  id: string;
  category: ExpenseCategory;
  amount: number;
  /** `YYYY-MM-DD` */
  incurredOn: string;
  note: string | null;
  createdByName: string | null;
  createdAt: Date;
}

export interface FinanceTotals {
  revenue: number;
  paidOrders: number;
  /** Cash spent on stock imports (cash basis, not cost of goods sold). */
  importCost: number;
  operatingCost: number;
  /** Estimated: worked hours x hourly rate. */
  salaryCost: number;
  totalCost: number;
  /** `revenue - totalCost` */
  profit: number;
}

export interface SalaryLine {
  userId: string;
  name: string;
  hours: number;
  hourlyRate: number | null;
  /** 0 when the rate is not set. */
  amount: number;
}

export interface FinanceDay {
  /** `YYYY-MM-DD` in the shop timezone. */
  date: string;
  revenue: number;
  importCost: number;
  operatingCost: number;
  salaryCost: number;
}

export interface FinanceSummary {
  /** `YYYY-MM-DD`, inclusive. */
  from: string;
  /** `YYYY-MM-DD`, exclusive. */
  to: string;
  totals: FinanceTotals;
  revenueByMethod: { method: PaymentMethod | null; amount: number }[];
  expensesByCategory: { category: ExpenseCategory; amount: number }[];
  salary: SalaryLine[];
  /** Staff who worked in the range but have no hourly rate (salary understated). */
  staffWithoutRate: number;
  daily: FinanceDay[];
}

/** Dataset for the external forecasting model (`GET /finance/export`). */
export interface FinanceExport {
  schemaVersion: 1;
  generatedAt: string;
  timezone: string;
  currency: 'VND';
  from: string;
  to: string;
  /** Today in the shop timezone; rows with `partial: true` are still filling. */
  today: string;
  daily: {
    date: string;
    /** ISO weekday, 1 = Monday .. 7 = Sunday. */
    dow: number;
    revenue: number;
    orders: number;
    importCost: number;
    /** Estimated pay for sessions checked in that day. */
    salaryCost: number;
    hoursWorked: number;
    operatingCost: number;
    expenses: Record<ExpenseCategory, number>;
    partial: boolean;
  }[];
  stockItems: {
    id: string;
    name: string;
    kind: 'goods' | 'material';
    unit: string;
    quantity: number;
    lowStockThreshold: number;
    lastUnitCost: number | null;
    isActive: boolean;
  }[];
  /** One row per receipt line (sparse). */
  importLines: {
    date: string;
    stockItemId: string;
    quantity: number;
    unitCost: number;
  }[];
  /** Signed stocktake/waste corrections per day and item (sparse). */
  stockAdjustments: { date: string; stockItemId: string; change: number }[];
  /** Assigned shifts from `from` to 60 days ahead of today. */
  roster: {
    date: string;
    userId: string;
    hours: number;
    hourlyRate: number | null;
  }[];
}

export interface ForecastTotal {
  p50: number;
  /** Sum of `p90`, falling back to `p50` where a point has no band. */
  high: number;
}

export interface ForecastView {
  id: string;
  generatedAt: Date;
  receivedAt: Date;
  modelName: string;
  modelVersion: string;
  dataThrough: string;
  horizonDays: number;
  points: ForecastPayload['points'];
  backtest: ForecastPayload['backtest'];
  commentary: string | null;
  /** Totals over the horizon, computed by the backend from the points. */
  summary: {
    from: string;
    to: string;
    revenue: ForecastTotal;
    importCost: ForecastTotal;
    salaryCost: ForecastTotal;
    operatingCost: ForecastTotal;
    /** Sum of the three cost lines. */
    totalCost: ForecastTotal;
    /** Money to keep aside: `totalCost` (expected and high case). */
    fundNeeded: ForecastTotal;
    /** `revenue.p50 - totalCost.p50` */
    expectedNet: number;
  };
}
