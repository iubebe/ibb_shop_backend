# Finance: investment records and ROI

Date: 23/10/2026

## Done
- Entity `Investment` (`src/database/entities/investment.entity.ts`), enum `InvestmentCategory`, migration `1792800000000-Investments.ts` (hand-written, mirrors `Finance1792300000000`).
- `InvestmentsService` (`src/modules/finance/investments.service.ts`): CRUD plus `roi(branchId, from, to)`.
- Admin-only endpoints on `FinanceController`: `GET/POST /api/finance/investments`, `PATCH/DELETE /api/finance/investments/:id`, `GET /api/finance/roi?from&to`.
- Excel export (`finance-export.service.ts`): new sheet "Đầu tư & ROI" (items, ROI summary, category pie); "Tổng quan" gained two rows (invested capital, ROI %).
- Tests: `__test__/investments.service.spec.ts`, export spec updated (7 charts, 5 sheets).

## Decisions (mine, not asked)
- ROI = profit of the selected range / capital invested before the end of the range (`profit` is the existing `FinanceTotals.profit`; investments are not counted as costs there). Profit is shop-level and is not split per item, so items show only their share of capital.
- Payback months = invested / (range profit scaled to 30 days); `null` when profit <= 0. ROI is `null` with no capital.
- Investments are not subject to the 366-day range cap; only the profit side is.

## Pending
- Migration not run anywhere (Docker was not running, so no throwaway-DB check or up/down/up test).
- Excel file not opened in real Excel; no check against a real backend.
- A cumulative (all-time) ROI would need profit beyond the 366-day limit; not built.
- Release bump in `ibb_shop_release`.
