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
