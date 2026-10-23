import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  ExpenseCategory,
  InvestmentCategory,
  PaymentMethod,
} from '../../database/enums.js';
import { addCharts, type ChartSpec } from './finance-export.charts.js';
import { FinanceService } from './finance.service.js';
import { InvestmentsService } from './investments.service.js';
import type {
  ExpenseView,
  FinanceSummary,
  RoiSummary,
} from './finance.types.js';

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  [ExpenseCategory.RENT]: 'Mặt bằng',
  [ExpenseCategory.ELECTRICITY]: 'Điện',
  [ExpenseCategory.WATER]: 'Nước',
  [ExpenseCategory.INTERNET]: 'Internet',
  [ExpenseCategory.GAS]: 'Gas',
  [ExpenseCategory.MAINTENANCE]: 'Sửa chữa, bảo trì',
  [ExpenseCategory.MARKETING]: 'Quảng cáo',
  [ExpenseCategory.OTHER]: 'Khác',
};

const INVESTMENT_LABEL: Record<InvestmentCategory, string> = {
  [InvestmentCategory.RENOVATION]: 'Thi công, cải tạo',
  [InvestmentCategory.EQUIPMENT]: 'Máy móc, thiết bị',
  [InvestmentCategory.FURNITURE]: 'Bàn ghế, nội thất',
  [InvestmentCategory.TECHNOLOGY]: 'Công nghệ, phần mềm',
  [InvestmentCategory.DEPOSIT]: 'Đặt cọc',
  [InvestmentCategory.OTHER]: 'Khác',
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: 'Tiền mặt',
  [PaymentMethod.QR_MANUAL]: 'Chuyển khoản / QR',
};

const MONEY = '#,##0';
const COLORS = {
  revenue: '#2E7D32',
  cost: '#C62828',
  neutral: '#1565C0',
};
const PIE_COLORS = [
  '#1565C0',
  '#EF6C00',
  '#2E7D32',
  '#6A1B9A',
  '#C62828',
  '#00838F',
  '#F9A825',
  '#546E7A',
];

const SHEET = {
  overview: { index: 1, name: 'Tổng quan' },
  daily: { index: 2, name: 'Theo ngày' },
  salary: { index: 3, name: 'Lương' },
  expenses: { index: 4, name: 'Chi phí vận hành' },
  investments: { index: 5, name: 'Đầu tư & ROI' },
} as const;

/** `2026-10-17` -> `17/10/2026` */
const formatDay = (day: string) => day.split('-').reverse().join('/');
/** `2026-10-17` -> `17/10` (chart axis labels). */
const formatShortDay = (day: string) => formatDay(day).slice(0, 5);

/** Excel report of the finance summary with native charts (admin only). */
@Injectable()
export class FinanceExportService {
  constructor(
    private readonly finance: FinanceService,
    private readonly investments: InvestmentsService,
  ) {}

  async exportXlsx(branchId: string, from: string, to: string): Promise<Buffer> {
    const [summary, expenses, roi] = await Promise.all([
      this.finance.summary(branchId, from, to),
      this.finance.listExpenses(branchId, from, to),
      this.investments.roi(branchId, from, to),
    ]);

    const workbook = new ExcelJS.Workbook();
    const charts: ChartSpec[] = [];
    this.overviewSheet(workbook, summary, roi, charts);
    this.dailySheet(workbook, summary, charts);
    this.salarySheet(workbook, summary, charts);
    this.expensesSheet(workbook, expenses);
    this.investmentsSheet(workbook, roi, charts);

    const plain = Buffer.from(await workbook.xlsx.writeBuffer());
    return addCharts(plain, charts);
  }

  private overviewSheet(
    workbook: ExcelJS.Workbook,
    data: FinanceSummary,
    roi: RoiSummary,
    charts: ChartSpec[],
  ) {
    const { index, name } = SHEET.overview;
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [{ width: 30 }, { width: 18 }, { width: 14 }];
    const lastDay = lastInclusiveDay(data.to);

    sheet.getCell('A1').value = 'Báo cáo tài chính';
    sheet.getCell('A1').font = { bold: true, size: 16 };
    sheet.getCell('A2').value =
      `Từ ${formatDay(data.from)} đến ${formatDay(lastDay)}`;

    const t = data.totals;
    let row = 4;
    row = writeTable(sheet, row, ['Chỉ tiêu', 'Giá trị'], [
      ['Doanh thu', t.revenue],
      ['Số đơn đã thanh toán', t.paidOrders],
      ['Nhập hàng (tiền đã chi)', t.importCost],
      ['Lương (ước tính)', t.salaryCost],
      ['Chi phí vận hành', t.operatingCost],
      ['Tổng chi', t.totalCost],
      ['Lợi nhuận', t.profit],
      ['Hao hụt / hủy hàng (đã nằm trong nhập hàng)', t.writeOffLoss],
      ['Vốn đầu tư (lũy kế đến cuối kỳ)', roi.totalInvested],
      ['ROI (%) = lợi nhuận kỳ / vốn đầu tư', roi.roiPercent ?? 0],
    ]).next;
    sheet.getCell('B14').numFmt = '0.0';
    if (roi.roiPercent === null) sheet.getCell('B14').value = 'Chưa có vốn';
    sheet.getCell('B6').numFmt = '0';
    sheet.getRow(11).font = { bold: true };
    if (data.staffWithoutRate > 0) {
      sheet.getCell(`A${row}`).value =
        `Lưu ý: ${data.staffWithoutRate} nhân viên chưa có lương theo giờ nên lương bị tính thiếu.`;
      sheet.getCell(`A${row}`).font = { italic: true, color: { argb: 'FFC62828' } };
      row += 1;
    }
    row += 1;

    const costs = writeTable(sheet, row, ['Nhóm chi phí', 'Số tiền'], [
      ['Nhập hàng', t.importCost],
      ['Lương (ước tính)', t.salaryCost],
      ['Vận hành', t.operatingCost],
    ]);
    charts.push(
      pieChart(index, name, 'Cơ cấu chi phí', costs, { col: 4, row: 3 }),
    );
    row = costs.next + 1;

    if (data.revenueByMethod.length > 0) {
      const methods = writeTable(
        sheet,
        row,
        ['Doanh thu theo hình thức', 'Số tiền'],
        data.revenueByMethod.map((m) => [
          m.method ? METHOD_LABEL[m.method] : 'Không rõ',
          m.amount,
        ]),
      );
      charts.push(
        pieChart(index, name, 'Doanh thu theo hình thức', methods, {
          col: 4,
          row: 20,
        }),
      );
      row = methods.next + 1;
    }

    if (data.expensesByCategory.length > 0) {
      const categories = writeTable(
        sheet,
        row,
        ['Chi phí vận hành theo nhóm', 'Số tiền'],
        data.expensesByCategory.map((c) => [
          CATEGORY_LABEL[c.category],
          c.amount,
        ]),
      );
      charts.push({
        sheet: index,
        sheetName: name,
        kind: 'bar',
        title: 'Chi phí vận hành theo nhóm',
        categories: categories.labels,
        categoryColumn: 'A',
        firstRow: categories.firstRow,
        seriesColumns: ['B'],
        series: [
          { name: 'Số tiền', values: categories.values, color: COLORS.cost },
        ],
        anchor: { col: 4, row: 37, cols: 9, rows: 16 },
      });
    }
  }

  private dailySheet(
    workbook: ExcelJS.Workbook,
    data: FinanceSummary,
    charts: ChartSpec[],
  ) {
    const { index, name } = SHEET.daily;
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [
      { header: 'Ngày', width: 12 },
      { header: 'Doanh thu', width: 16, style: { numFmt: MONEY } },
      { header: 'Nhập hàng', width: 16, style: { numFmt: MONEY } },
      { header: 'Vận hành', width: 16, style: { numFmt: MONEY } },
      { header: 'Lương (ước tính)', width: 18, style: { numFmt: MONEY } },
      { header: 'Tổng chi', width: 16, style: { numFmt: MONEY } },
      { header: 'Lợi nhuận', width: 16, style: { numFmt: MONEY } },
    ];
    for (const d of data.daily) {
      const cost = d.importCost + d.operatingCost + d.salaryCost;
      sheet.addRow([
        formatShortDay(d.date),
        d.revenue,
        d.importCost,
        d.operatingCost,
        d.salaryCost,
        cost,
        d.revenue - cost,
      ]);
    }
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    if (data.daily.length === 0) return;

    const labels = data.daily.map((d) => formatShortDay(d.date));
    const column = (pick: (d: FinanceSummary['daily'][number]) => number) =>
      data.daily.map(pick);
    const costOf = (d: FinanceSummary['daily'][number]) =>
      d.importCost + d.operatingCost + d.salaryCost;
    charts.push({
      sheet: index,
      sheetName: name,
      kind: 'column',
      title: 'Doanh thu và chi phí theo ngày',
      categories: labels,
      categoryColumn: 'A',
      firstRow: 2,
      seriesColumns: ['B', 'F'],
      series: [
        { name: 'Doanh thu', values: column((d) => d.revenue), color: COLORS.revenue },
        { name: 'Tổng chi', values: column(costOf), color: COLORS.cost },
      ],
      anchor: { col: 8, row: 1, cols: 12, rows: 18 },
    });
    charts.push({
      sheet: index,
      sheetName: name,
      kind: 'column',
      title: 'Lợi nhuận theo ngày',
      categories: labels,
      categoryColumn: 'A',
      firstRow: 2,
      seriesColumns: ['G'],
      series: [
        {
          name: 'Lợi nhuận',
          values: column((d) => d.revenue - costOf(d)),
          color: COLORS.neutral,
        },
      ],
      anchor: { col: 8, row: 20, cols: 12, rows: 16 },
    });
  }

  private salarySheet(
    workbook: ExcelJS.Workbook,
    data: FinanceSummary,
    charts: ChartSpec[],
  ) {
    const { index, name } = SHEET.salary;
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [
      { header: 'Nhân viên', width: 28 },
      { header: 'Giờ làm', width: 12, style: { numFmt: '0.00' } },
      { header: 'Lương theo giờ', width: 16, style: { numFmt: MONEY } },
      { header: 'Thành tiền', width: 16, style: { numFmt: MONEY } },
    ];
    for (const s of data.salary) {
      sheet.addRow([s.name, s.hours, s.hourlyRate ?? 'Chưa đặt', s.amount]);
    }
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    if (data.salary.length === 0) return;

    charts.push({
      sheet: index,
      sheetName: name,
      kind: 'bar',
      title: 'Lương ước tính theo nhân viên',
      categories: data.salary.map((s) => s.name),
      categoryColumn: 'A',
      firstRow: 2,
      seriesColumns: ['D'],
      series: [
        {
          name: 'Thành tiền',
          values: data.salary.map((s) => s.amount),
          color: COLORS.neutral,
        },
      ],
      anchor: { col: 5, row: 1, cols: 9, rows: Math.max(14, data.salary.length * 2) },
    });
  }

  private investmentsSheet(
    workbook: ExcelJS.Workbook,
    roi: RoiSummary,
    charts: ChartSpec[],
  ) {
    const { index, name } = SHEET.investments;
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [
      { header: 'Ngày', width: 14 },
      { header: 'Hạng mục', width: 30 },
      { header: 'Nhóm', width: 22 },
      { header: 'Số tiền', width: 16, style: { numFmt: MONEY } },
      { header: 'Tỷ trọng vốn (%)', width: 16, style: { numFmt: '0.0' } },
      { header: 'Ghi chú', width: 30 },
    ];
    for (const i of roi.items) {
      sheet.addRow([
        formatDay(i.investedOn),
        i.name,
        INVESTMENT_LABEL[i.category],
        i.amount,
        i.sharePercent,
        i.note ?? '',
      ]);
    }
    sheet.addRow(['Tổng', '', '', roi.totalInvested]);
    sheet.lastRow!.font = { bold: true };
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    let row = sheet.rowCount + 2;
    const lastDay = lastInclusiveDay(roi.to);
    sheet.getCell(`A${row}`).value =
      `ROI kỳ ${formatDay(roi.from)} - ${formatDay(lastDay)}`;
    sheet.getCell(`A${row}`).font = { bold: true };
    row += 1;
    const summaryTable = writeTable(sheet, row, ['Chỉ tiêu', 'Giá trị'], [
      ['Vốn đầu tư (lũy kế đến cuối kỳ)', roi.totalInvested],
      ['Đầu tư trong kỳ', roi.investedInRange],
      ['Lợi nhuận kỳ', roi.profit],
      ['ROI (%)', roi.roiPercent ?? 0],
      ['Thời gian hoàn vốn (tháng)', roi.paybackMonths ?? 0],
    ]);
    sheet.getCell(`B${row + 4}`).numFmt = '0.0';
    sheet.getCell(`B${row + 5}`).numFmt = '0.0';
    if (roi.roiPercent === null) sheet.getCell(`B${row + 4}`).value = 'Chưa có vốn';
    if (roi.paybackMonths === null) {
      sheet.getCell(`B${row + 5}`).value = 'Chưa hoàn vốn / chưa có lãi';
    }
    row = summaryTable.next;
    sheet.getCell(`A${row + 1}`).value =
      'ROI = lợi nhuận của kỳ / vốn đầu tư. Lợi nhuận tính cho cả cửa hàng, không chia theo từng hạng mục. Hoàn vốn = vốn / (lợi nhuận kỳ quy ra 30 ngày).';
    sheet.getCell(`A${row + 1}`).font = { italic: true };
    row += 3;

    if (roi.byCategory.length === 0) return;
    const categories = writeTable(
      sheet,
      row,
      ['Vốn theo nhóm', 'Số tiền'],
      roi.byCategory.map((c) => [INVESTMENT_LABEL[c.category], c.amount]),
    );
    charts.push(
      pieChart(index, name, 'Cơ cấu vốn đầu tư', categories, { col: 7, row: 1 }),
    );
  }

  private expensesSheet(workbook: ExcelJS.Workbook, expenses: ExpenseView[]) {
    const sheet = workbook.addWorksheet(SHEET.expenses.name);
    sheet.columns = [
      { header: 'Ngày', width: 14 },
      { header: 'Nhóm', width: 22 },
      { header: 'Số tiền', width: 16, style: { numFmt: MONEY } },
      { header: 'Ghi chú', width: 36 },
      { header: 'Người nhập', width: 22 },
    ];
    for (const e of expenses) {
      sheet.addRow([
        formatDay(e.incurredOn),
        CATEGORY_LABEL[e.category],
        e.amount,
        e.note ?? '',
        e.createdByName ?? '',
      ]);
    }
    sheet.addRow(['Tổng', '', expenses.reduce((s, e) => s + e.amount, 0)]);
    sheet.lastRow!.font = { bold: true };
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }
}

interface WrittenTable {
  firstRow: number;
  next: number;
  labels: string[];
  values: number[];
}

/** Writes a two-column table at `row`; returns where its data and the next free row are. */
function writeTable(
  sheet: ExcelJS.Worksheet,
  row: number,
  header: [string, string],
  lines: [string, number][],
): WrittenTable {
  const head = sheet.getRow(row);
  head.values = header;
  head.font = { bold: true };
  lines.forEach(([label, value], i) => {
    const r = sheet.getRow(row + 1 + i);
    r.values = [label, value];
    r.getCell(2).numFmt = MONEY;
  });
  return {
    firstRow: row + 1,
    next: row + 1 + lines.length,
    labels: lines.map(([label]) => label),
    values: lines.map(([, value]) => value),
  };
}

function pieChart(
  sheet: number,
  sheetName: string,
  title: string,
  table: WrittenTable,
  at: { col: number; row: number },
): ChartSpec {
  return {
    sheet,
    sheetName,
    kind: 'pie',
    title,
    categories: table.labels,
    categoryColumn: 'A',
    firstRow: table.firstRow,
    seriesColumns: ['B'],
    series: [{ name: 'Số tiền', values: table.values, color: COLORS.neutral }],
    sliceColors: PIE_COLORS,
    anchor: { ...at, cols: 7, rows: 16 },
  };
}

/** `to` is exclusive; the report header shows the last day included. */
function lastInclusiveDay(to: string): string {
  const day = new Date(`${to}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}
