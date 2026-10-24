import { Injectable } from '@nestjs/common';
import { FinanceService } from './finance.service.js';
import type { BreakEvenSummary, FinanceTotals } from './finance.types.js';
import { InvestmentsService } from './investments.service.js';

/** Months in which the KPI profit target should pay back the invested capital. */
export const PAYBACK_TARGET_MONTHS = 24;

const MS_PER_DAY = 86_400_000;

const round1 = (n: number) => Math.round(n * 10) / 10;
const up = (n: number) => Math.ceil(n);

/** Pure maths of the break-even point and the suggested KPIs. */
export function computeBreakEven(
  range: { from: string; to: string },
  totals: FinanceTotals,
  totalInvested: number,
): BreakEvenSummary {
  const days =
    (Date.parse(`${range.to}T00:00:00Z`) -
      Date.parse(`${range.from}T00:00:00Z`)) /
    MS_PER_DAY;
  const fixedCost = totals.operatingCost + totals.salaryCost;
  const variableCostRatio =
    totals.revenue > 0 ? totals.importCost / totals.revenue : null;
  const margin = variableCostRatio === null ? null : 1 - variableCostRatio;
  const usableMargin = margin !== null && margin > 0 ? margin : null;
  const avgOrderValue =
    totals.paidOrders > 0 ? totals.revenue / totals.paidOrders : null;

  const ordersFor = (revenue: number | null) =>
    revenue !== null && avgOrderValue ? up(revenue / avgOrderValue) : null;
  const perDay = (n: number | null) => (n === null ? null : up(n / days));

  const breakEvenRevenue =
    usableMargin === null ? null : up(fixedCost / usableMargin);
  const targetProfit =
    totalInvested > 0 ? Math.round(totalInvested / PAYBACK_TARGET_MONTHS) : 0;
  const targetRevenue =
    usableMargin === null ? null : up((fixedCost + targetProfit) / usableMargin);
  const targetOrders = ordersFor(targetRevenue);

  return {
    from: range.from,
    to: range.to,
    days,
    fixedCost,
    variableCostRatio:
      variableCostRatio === null ? null : round1(variableCostRatio * 100) / 100,
    contributionMarginRatio: margin === null ? null : round1(margin * 100) / 100,
    avgOrderValue: avgOrderValue === null ? null : Math.round(avgOrderValue),
    breakEvenRevenue,
    breakEvenRevenuePerDay: perDay(breakEvenRevenue),
    breakEvenOrdersPerDay: perDay(ordersFor(breakEvenRevenue)),
    revenue: totals.revenue,
    paidOrders: totals.paidOrders,
    profit: totals.profit,
    breakEvenProgressPercent:
      breakEvenRevenue && breakEvenRevenue > 0
        ? round1((totals.revenue / breakEvenRevenue) * 100)
        : null,
    kpi: {
      targetProfit,
      paybackTargetMonths: PAYBACK_TARGET_MONTHS,
      totalInvested,
      targetRevenue,
      targetRevenuePerDay: perDay(targetRevenue),
      targetOrders,
      targetOrdersPerDay: perDay(targetOrders),
      maxImportCost:
        targetRevenue === null || variableCostRatio === null
          ? null
          : Math.round(targetRevenue * variableCostRatio),
    },
  };
}

@Injectable()
export class BreakEvenService {
  constructor(
    private readonly finance: FinanceService,
    private readonly investments: InvestmentsService,
  ) {}

  async breakEven(
    branchId: string,
    from: string,
    to: string,
  ): Promise<BreakEvenSummary> {
    const [summary, roi] = await Promise.all([
      this.finance.summary(branchId, from, to),
      this.investments.roi(branchId, from, to),
    ]);
    return computeBreakEven({ from, to }, summary.totals, roi.totalInvested);
  }
}
