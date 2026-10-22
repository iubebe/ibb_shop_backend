import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { ExpenseCategory, PaymentMethod } from '../../../database/enums.js';
import { FinanceExportService } from '../finance-export.service.js';
import type { FinanceService } from '../finance.service.js';
import type { ExpenseView, FinanceSummary } from '../finance.types.js';

const summary: FinanceSummary = {
  from: '2026-10-01',
  to: '2026-10-04',
  totals: {
    revenue: 300_000,
    paidOrders: 5,
    importCost: 100_000,
    operatingCost: 50_000,
    writeOffLoss: 10_000,
    salaryCost: 40_000,
    totalCost: 190_000,
    profit: 110_000,
  },
  revenueByMethod: [
    { method: PaymentMethod.CASH, amount: 200_000 },
    { method: PaymentMethod.QR_MANUAL, amount: 100_000 },
  ],
  expensesByCategory: [{ category: ExpenseCategory.RENT, amount: 50_000 }],
  salary: [
    { userId: 'u1', name: 'An', hours: 8, hourlyRate: 5_000, amount: 40_000 },
  ],
  staffWithoutRate: 0,
  daily: ['01', '02', '03'].map((d, i) => ({
    date: `2026-10-${d}`,
    revenue: 100_000 * (i + 1) - 100_000 * i,
    importCost: 0,
    operatingCost: 0,
    writeOffLoss: 0,
    salaryCost: 0,
  })),
};

const expenses: ExpenseView[] = [
  {
    id: 'e1',
    category: ExpenseCategory.RENT,
    amount: 50_000,
    incurredOn: '2026-10-02',
    note: null,
    createdByName: 'Admin',
    createdAt: new Date(),
  },
];

function service(data: FinanceSummary = summary) {
  const finance = {
    summary: vi.fn().mockResolvedValue(data),
    listExpenses: vi.fn().mockResolvedValue(expenses),
  } as unknown as FinanceService;
  return new FinanceExportService(finance);
}

describe('FinanceExportService', () => {
  it('writes the data sheets and reloads as a valid workbook', async () => {
    const buffer = await service().exportXlsx('b1', '2026-10-01', '2026-10-04');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as never);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Tổng quan',
      'Theo ngày',
      'Lương',
      'Chi phí vận hành',
    ]);
    expect(wb.getWorksheet('Tổng quan')!.getCell('B5').value).toBe(300_000);
    expect(wb.getWorksheet('Theo ngày')!.rowCount).toBe(4);
  });

  it('wires every chart into its sheet, drawing and content types', async () => {
    const buffer = await service().exportXlsx('b1', '2026-10-01', '2026-10-04');
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files);

    // overview: cost pie, method pie, category bar; daily: 2; salary: 1.
    expect(files.filter((f) => /^xl\/charts\/chart\d+\.xml$/.test(f))).toHaveLength(6);
    const types = await zip.file('[Content_Types].xml')!.async('string');
    expect(types.match(/drawingml\.chart\+xml/g)).toHaveLength(6);
    expect(types.match(/drawing\+xml/g)).toHaveLength(3);

    for (const sheet of [1, 2, 3]) {
      const xml = await zip.file(`xl/worksheets/sheet${sheet}.xml`)!.async('string');
      expect(xml).toContain('<drawing r:id="rIdFinanceDrawing"/>');
      expect(xml.indexOf('<drawing ')).toBeLessThan(xml.indexOf('</worksheet>'));
    }
    expect(files).not.toContain('xl/worksheets/sheet4.xml.rels');

    const daily = await zip.file('xl/charts/chart4.xml')!.async('string');
    expect(daily).toContain("'Theo ngày'!$B$2:$B$4");
    expect(daily).toContain('<c:barDir val="col"/>');
  });

  it('skips charts without data but still exports', async () => {
    const empty: FinanceSummary = {
      ...summary,
      revenueByMethod: [],
      expensesByCategory: [],
      salary: [],
      daily: [],
    };
    const buffer = await service(empty).exportXlsx('b1', '2026-10-01', '2026-10-04');
    const zip = await JSZip.loadAsync(buffer);
    const charts = Object.keys(zip.files).filter((f) => /^xl\/charts\/chart\d+\.xml$/.test(f));
    expect(charts).toHaveLength(1);
  });
});
