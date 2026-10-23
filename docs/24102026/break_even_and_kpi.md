# Finance: break-even and suggested KPIs

Date: 24/10/2026. Builds on `docs/23102026/finance_investments_roi.md`.

## Done
- `src/modules/finance/break-even.service.ts`: pure `computeBreakEven` plus `BreakEvenService`; `GET /api/finance/break-even?from&to` (admin).
- Excel: new sheet "Hòa vốn & KPI" (break-even table, KPI table, actual/break-even/target revenue column chart).
- Tests: `__test__/break-even.service.spec.ts`; export spec updated (6 sheets, 8 charts).

## Formulas
- Fixed cost = operating expenses + estimated salary. Variable cost = stock imports (cash basis).
- Margin = 1 - imports / revenue. Break-even revenue = fixed / margin (null without revenue or when margin <= 0).
- Orders = revenue / average order value of the month. Per-day figures divide by days in the range.
- KPI profit = total invested / 24 months (0 without capital). KPI revenue = (fixed + KPI profit) / margin. Import ceiling = KPI revenue x current import ratio.

## Decisions (mine, not asked)
- No depreciation in fixed costs. The 24-month payback target is a constant (`PAYBACK_TARGET_MONTHS`), not configurable.
- Costs are the month's actuals, so mid-month the break-even is understated; the UI says so.
- "KPI per month" is for the selected month only, not a multi-month plan.

## Pending
- Not opened in Excel; UI not browser-checked at 390px; no real-backend check; release bump.
- Next: configurable payback target, break-even from averaged months, depreciation.
