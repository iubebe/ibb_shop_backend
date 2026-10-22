# Finance Excel export with charts

Date: 22/10/2026

## Done
- `GET /api/finance/export?from=YYYY-MM-DD&to=YYYY-MM-DD` (admin only, same `[from, to)` range rules as `/finance/summary`) returns an `.xlsx`.
- Sheets: Tổng quan (totals + cost / revenue-method / expense-category tables), Theo ngày (daily table), Lương, Chi phí vận hành (expense list).
- Native, editable Excel charts: cost-mix pie, revenue-by-method pie, expenses-by-category bar, revenue vs total cost per day, profit per day, salary per staff. Charts with no data are skipped.
- Code: `src/modules/finance/finance-export.service.ts` (workbook), `finance-export.charts.ts` (chart injection), controller route in `finance.controller.ts`. Test: `src/modules/finance/__test__/finance-export.service.spec.ts`.

## Decisions
- exceljs cannot draw charts, so the chart OOXML parts are written into the finished zip with `jszip` (added as a direct dependency, already in the lockfile via exceljs). Chosen over embedding PNGs so the charts stay editable and need no native image library.
- Reuses `FinanceService.summary` and `listExpenses`, so the numbers match the `/finance` screen. Same caveats apply (salary is an estimate, import cost is cash basis, write-offs are not added to total cost).

## Pending
- Opened-in-Excel check: only XML well-formedness, element order and an exceljs reload were verified here (no Excel/LibreOffice on this machine). Open one real export in Excel before release.
- Release bump in `ibb_shop_release`.

UI: see `ibb_sms/docs/22102026/finance_excel_export.md`.
