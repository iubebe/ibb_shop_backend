import { computeBreakEven } from '../break-even.service.js';
import type { FinanceTotals } from '../finance.types.js';

const range = { from: '2026-10-01', to: '2026-11-01' };

const totals = (over: Partial<FinanceTotals> = {}): FinanceTotals => ({
  revenue: 100_000_000,
  paidOrders: 1_000,
  importCost: 35_000_000,
  operatingCost: 15_000_000,
  writeOffLoss: 0,
  salaryCost: 20_000_000,
  totalCost: 70_000_000,
  profit: 30_000_000,
  ...over,
});

describe('computeBreakEven', () => {
  it('divides fixed costs by the contribution margin', () => {
    const be = computeBreakEven(range, totals(), 0);

    expect(be.fixedCost).toBe(35_000_000);
    expect(be.contributionMarginRatio).toBe(0.65);
    expect(be.avgOrderValue).toBe(100_000);
    expect(be.breakEvenRevenue).toBe(53_846_154);
    expect(be.breakEvenRevenuePerDay).toBe(1_736_973);
    expect(be.breakEvenOrdersPerDay).toBe(18);
    expect(be.breakEvenProgressPercent).toBe(185.7);
  });

  it('sets the KPI profit so the capital pays back in 24 months', () => {
    const { kpi } = computeBreakEven(range, totals(), 240_000_000);

    expect(kpi.targetProfit).toBe(10_000_000);
    // (35M + 10M) / 0.65
    expect(kpi.targetRevenue).toBe(69_230_770);
    expect(kpi.targetOrders).toBe(693);
    expect(kpi.maxImportCost).toBe(24_230_770);
  });

  it('has no break-even without revenue or without a positive margin', () => {
    const none = computeBreakEven(
      range,
      totals({ revenue: 0, paidOrders: 0, importCost: 0 }),
      0,
    );
    expect(none.breakEvenRevenue).toBeNull();
    expect(none.kpi.targetRevenue).toBeNull();

    const loss = computeBreakEven(range, totals({ importCost: 110_000_000 }), 0);
    expect(loss.breakEvenRevenue).toBeNull();
  });
});
