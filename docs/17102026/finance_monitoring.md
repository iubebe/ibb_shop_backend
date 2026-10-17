# Finance monitoring (admin) — 17/10/2026

## What was done
New admin-only module `src/modules/finance` under `/api/finance`:
- `GET /finance/summary?from&to` (`YYYY-MM-DD`, `[from, to)`, max 366 days, shop timezone): revenue (paid orders by `paidAt`, split by payment method), stock-import cost, operating expenses by category, estimated salary per staff, profit, and a per-day series.
- Expenses CRUD: `GET/POST /finance/expenses`, `PATCH/DELETE /finance/expenses/:id`. Entity `Expense` (`expenses` table), categories in `ExpenseCategory` (rent, electricity, water, internet, gas, maintenance, marketing, other).
- `users.hourlyRate` (nullable, VND/hour) editable via `PATCH /users/:id`; exposed in the admin user list.
- Migration `1792300000000-Finance.ts` (hand-written, tested up/down/up on a throwaway DB).

## Decisions
- Salary is an **estimate**: completed attendance sessions (check-out set) × hourly rate, attributed to the check-in day. Staff with hours but no rate are counted in `staffWithoutRate`; the UI warns.
- Cash basis: import cost is money spent on imports in the range, not cost of goods sold. Profit = revenue − imports − salary − operating.
- Admin only, like revenue and stock costs ([catalog decisions](../05102026/)).

## Verified
`pnpm build`, lint; script against throwaway DB: timezone day boundaries, cancelled orders excluded, open sessions excluded, missing rate, expense CRUD, range/date errors.

## Pending
- Migration not applied to dev DB `ibb` (`pnpm migration:run`).
- No unit tests in `__test__/`; no HTTP test as logged-in admin.
- Recurring expenses, budgets, forecast: see `forecast_proposal.md`.
- `ibb_shop_release` version bump.
UI: `ibb_sms/docs/17102026/finance_ui.md`.
