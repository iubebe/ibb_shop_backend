# Dashboard API

Date: 05/10/2026

## Done
- `GET /api/dashboard` (`src/modules/dashboard/`, registered in `src/app.module.ts`), roles admin, staff and cashier, scoped to the caller's branch.
- Response: `since` (start of today), `queue` (`pendingConfirmation`, `confirmed`, `unservedItems` = units not yet delivered on confirmed orders), `recentOrders` (latest 10 created today: table name, status, total, unit count) and `sales` (`revenue`, `paidOrders`, `topProducts` top 5 by quantity with revenue, all for orders paid today).
- Decision (user): revenue and top products are admin only. The service returns `sales: null` for staff/cashier and does not even run those queries, so the frontend hiding is not the only protection.
- "Today" is the shop-local day: new optional env `SHOP_TIMEZONE` (IANA name, default `Asia/Ho_Chi_Minh`, added to `.env.example`). Revenue counts orders by `paidAt`, not `createdAt`.
- Raw SQL (`DataSource.query`) with numeric columns cast to `float8`/`int` so JSON gets numbers, not strings.

## Verified
- Build, lint, tests (101 pass; new `__test__/dashboard.service.spec.ts` covers admin vs staff/cashier, mapping and timezone). Each SQL statement was run read-only against the dev database (valid; today there are no paid orders, so revenue and top products are empty). Booted `dist/main`: route mapped, unauthenticated call is 401.
- Not verified: an authenticated response, and sales with real paid orders.

## Pending
- Push updates over the WebSocket (`order:updated` still not emitted); the frontend polls every 15 s.
- Range options (7 days) were declined for now. Cancelled orders are not counted in revenue.

Frontend: `ibb_sms/docs/05102026/dashboard_page.md`.
