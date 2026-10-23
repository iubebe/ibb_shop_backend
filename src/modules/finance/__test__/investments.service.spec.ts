import { InvestmentCategory } from '../../../database/enums.js';
import type { FinanceService } from '../finance.service.js';
import type { InvestmentView } from '../finance.types.js';
import { InvestmentsService } from '../investments.service.js';

const item = (
  id: string,
  amount: number,
  investedOn: string,
  category = InvestmentCategory.EQUIPMENT,
): InvestmentView => ({
  id,
  name: id,
  category,
  amount,
  investedOn,
  note: null,
  createdByName: null,
  createdAt: new Date(),
});

function service(rows: InvestmentView[], profit: number) {
  const finance = {
    summary: vi.fn().mockResolvedValue({ totals: { profit } }),
  } as unknown as FinanceService;
  const svc = new InvestmentsService({} as never, finance);
  vi.spyOn(svc, 'list').mockResolvedValue(rows);
  return svc;
}

describe('InvestmentsService.roi', () => {
  it('counts capital invested before the end of the range only', async () => {
    const svc = service(
      [
        item('a', 600_000, '2026-09-15'),
        item('b', 400_000, '2026-10-10', InvestmentCategory.FURNITURE),
        item('late', 900_000, '2026-11-01'),
      ],
      100_000,
    );
    const roi = await svc.roi('b1', '2026-10-01', '2026-11-01');

    expect(roi.totalInvested).toBe(1_000_000);
    expect(roi.investedInRange).toBe(400_000);
    expect(roi.roiPercent).toBe(10);
    // 100k profit over 31 days -> ~96.8k per 30 days -> 10.3 months.
    expect(roi.paybackMonths).toBe(10.3);
    expect(roi.items.map((i) => [i.id, i.sharePercent])).toEqual([
      ['a', 60],
      ['b', 40],
    ]);
    expect(roi.byCategory[0]).toEqual({
      category: InvestmentCategory.EQUIPMENT,
      amount: 600_000,
    });
  });

  it('has no ROI or payback without capital or without profit', async () => {
    const none = await service([], 50_000).roi('b1', '2026-10-01', '2026-11-01');
    expect(none.roiPercent).toBeNull();
    expect(none.paybackMonths).toBeNull();

    const loss = await service([item('a', 100_000, '2026-10-02')], -20_000).roi(
      'b1',
      '2026-10-01',
      '2026-11-01',
    );
    expect(loss.roiPercent).toBe(-20);
    expect(loss.paybackMonths).toBeNull();
  });
});
