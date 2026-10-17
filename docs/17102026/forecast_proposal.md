# Proposal: forecasting funds for salary, imports and operating costs — 17/10/2026

Builds on `finance_monitoring.md`. Proposal only, nothing implemented.

## Approach: three small models, one "cash needed" view
Forecast per cost line separately (each behaves differently), then sum into "money to keep aside for the next 30 days / next month".

1. **Salary — schedule-driven, not statistical.** Cost = approved shifts for the coming period (`staff_schedules` + registrations) × shift hours × `hourlyRate`. Accurate because the roster already exists. Beyond the published roster, fall back to the trailing 4-week average hours per staff. Add payroll lead time (pay day) so the fund is ready before it.
2. **Imports — demand-driven.** Per stock item: average daily usage (from the stock ledger: imports minus adjustments, or later recipe deductions) over 28 days, weighted for day-of-week; `days of cover = quantity / daily usage`. Predicted purchase = (target cover − current cover) × usage × `lastUnitCost`. Cross-check with a total: trailing 4-week import spend, scaled by forecast revenue growth. Seasonality: day-of-week factors, plus holidays (Tết) flagged by the admin.
3. **Operating costs — recurring schedule + variable estimate.**
   - Fixed and dated (rent, internet): a `recurring_expenses` table (category, amount, day of month) generates the expected entries.
   - Variable (electricity, water, gas): average of the last 3–6 months, with a seasonal factor from last year's same month once 12 months of data exist; show a min–max band, not one number.

## Revenue side (for "can we afford it")
Forecast daily revenue with a day-of-week baseline (mean of the last 8 same weekdays, trimmed) times a trend factor (last 4 weeks vs the 4 before). Start with this simple method; only consider Holt-Winters/Prophet-style models after ~6 months of data, and only if the simple baseline's error (MAPE) is clearly beaten on a backtest.

## Output for the admin
- "Next 30 days": expected revenue, expected costs per line, and **fund to reserve** = expected costs − expected revenue shortfall, as a range (P50 / P80 using historical error of the same method).
- Alerts: stock items under 3 days of cover, payday within 7 days with reserve below payroll, a cost line >20% above its own average.
- Budgets: optional monthly budget per category, shown as actual vs budget vs forecast.

## Implementation steps
1. Data first: add `recurring_expenses`; ensure shop admins enter bills monthly (the most valuable input). Needs ≥ 3 months of history for useful variable-cost forecasts.
2. `GET /finance/forecast?horizon=30` in the finance module, pure SQL + TypeScript (moving averages, day-of-week factors). No ML dependency needed.
3. Backtest endpoint/script: replay the method on past months, record error per line; show the band from this error.
4. UI: "Dự báo" tab: reserve card, per-line table with ranges, alerts list.
5. Later: recipes → exact material usage; supplier lead times; AI-written summary (Claude API) over the numbers, as commentary only, not as the calculation.

## Open questions
- Pay cycle (monthly/weekly, pay day)? Are shifts paid by actual hours or rostered hours?
- Should stock selling-side deduction (recipes) come first? It sharpens the imports forecast most.
- Any cost lines beyond the categories now (loan repayment, tax, insurance)?
