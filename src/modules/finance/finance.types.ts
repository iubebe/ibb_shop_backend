import type {
  ExpenseCategory,
  InvestmentCategory,
  PaymentMethod,
} from '../../database/enums.js';

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
  /** Cost of confirmed stock write-offs (spoiled/expired). Already inside `importCost` (cash basis), so not added to `totalCost`. */
  writeOffLoss: number;
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
  writeOffLoss: number;
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

export interface InvestmentView {
  id: string;
  name: string;
  category: InvestmentCategory;
  amount: number;
  /** `YYYY-MM-DD` */
  investedOn: string;
  note: string | null;
  createdByName: string | null;
  createdAt: Date;
}

/**
 * Shop-level return on the capital invested up to the end of `[from, to)`:
 * profit of the range (see `FinanceTotals.profit`) over that capital.
 * Profit is not split per item, so items only show their share of the capital.
 */
export interface RoiSummary {
  /** `YYYY-MM-DD`, inclusive. */
  from: string;
  /** `YYYY-MM-DD`, exclusive. */
  to: string;
  /** Sum of investments made before `to`. */
  totalInvested: number;
  /** Part of `totalInvested` spent inside the range. */
  investedInRange: number;
  /** Profit of the range. */
  profit: number;
  /** `profit / totalInvested * 100`; `null` when nothing is invested. */
  roiPercent: number | null;
  /** Months to earn back `totalInvested` at this range's profit rate; `null` when profit is not positive. */
  paybackMonths: number | null;
  byCategory: { category: InvestmentCategory; amount: number }[];
  items: (InvestmentView & { sharePercent: number })[];
}

/** Operating break-even of `[from, to)` plus suggested KPI targets for the same month. */
export interface BreakEvenSummary {
  from: string;
  to: string;
  days: number;
  /** Operating expenses + estimated salary of the range. */
  fixedCost: number;
  /** `importCost / revenue`; `null` without revenue. */
  variableCostRatio: number | null;
  /** `1 - variableCostRatio`; `null` without revenue. */
  contributionMarginRatio: number | null;
  /** `revenue / paidOrders`; `null` without paid orders. */
  avgOrderValue: number | null;
  /** `fixedCost / contributionMarginRatio`; `null` when the margin is not positive. */
  breakEvenRevenue: number | null;
  breakEvenRevenuePerDay: number | null;
  breakEvenOrdersPerDay: number | null;
  revenue: number;
  paidOrders: number;
  profit: number;
  /** `revenue / breakEvenRevenue * 100`; `null` when there is no break-even. */
  breakEvenProgressPercent: number | null;
  kpi: {
    /** Monthly profit that pays back `totalInvested` in `paybackTargetMonths`; 0 without capital. */
    targetProfit: number;
    paybackTargetMonths: number;
    totalInvested: number;
    targetRevenue: number | null;
    targetRevenuePerDay: number | null;
    targetOrders: number | null;
    targetOrdersPerDay: number | null;
    /** Import spend to stay under at `targetRevenue`, keeping today's cost ratio. */
    maxImportCost: number | null;
  };
}
