# Guest API and demo seed

Date: 05/10/2026

Moves the guest app's mock data (menu, drinks, tables, sample orders) into Postgres and exposes it to the guest web. Frontend side: `ibb_shop_guest/docs/05102026/backend_integration.md`.

## Done
- `src/modules/guest/` (`GuestModule`, imported in `src/app.module.ts`), all `@Public()`, scoped by the table's `qrToken`:
  - `GET /api/guest/tables/:qrToken` -> `{ id, name }` (404 if unknown token).
  - `GET /api/guest/tables/:qrToken/menu` -> categories + active products of the table's branch.
  - `GET /api/guest/tables/:qrToken/orders` -> open orders (`pending_confirmation`, `confirmed`) of the table, newest first.
  - `POST /api/guest/tables/:qrToken/orders` -> creates a `pending_confirmation` order. Needs the CSRF header like every unsafe request.
- Order creation (`guest.service.ts`): in one transaction; prices come from the database (client prices are never accepted), duplicate product lines are merged, products must be active and in the table's branch (else 400), `total` and `unitPrice` snapshots are stored.
- Validation: added `class-validator` + `class-transformer` and a global `ValidationPipe` (whitelist, forbid unknown fields, transform) in `src/main.ts`. DTO limits: 1-50 lines, quantity 1-99, notes max 200 chars. Existing `@Body() body: unknown` handlers in auth are unaffected.
- Demo seed: `pnpm db:seed:demo` (`src/database/seed-demo.ts`, data in `src/database/seed-data/demo-menu.ts`): 4 categories, 10 products (food + drinks), 12 tables (`Bàn 1..12`, tokens `demo-table-01..12`), 3 sample orders on tables 1 and 2. Idempotent; refuses to run when `NODE_ENV=production`.
- Tests: `src/modules/guest/__test__/guest.service.spec.ts` (82 tests pass in total), lint clean.

## Verified
Built app against local Postgres + Redis: table lookup, 404 on bad token, menu, orders list; POST without CSRF -> 403; with CSRF -> 201 with server-side price and merged lines; bad body -> 400 listing the errors; unknown product -> 400; CORS preflight from `http://localhost:5173` allows the CSRF header with credentials. The test order was deleted afterwards.

## Decisions
- Table identity is the `qrToken` (as in `docs/init/01-data-model.md`), so the guest URL is `/?table=<qrToken>` and the numeric table picker was dropped.
- Menu order = `createdAt` (the seed inserts rows one by one). There is no `sortOrder` column yet.
- Image URLs stay null; no upload or static serving exists yet.
- Demo tokens are predictable on purpose for local dev only. Real tables must get random tokens when the admin table CRUD exists.

## Pending / next
- Admin/staff CRUD for categories, products and tables (planned for `ibb_sms`), plus a `sortOrder` column.
- Realtime: emit a WebSocket event when a guest order is created so `ibb_sms` reception sees it; not wired.
- Rate limiting on `POST .../orders` beyond the global throttle; guest order spam from one table.
- Guests only see open orders; paid/cancelled disappear from the guest view by design.
- Release: bump backend and guest versions in `ibb_shop_release` and run the demo seed only in non-production stacks (nothing done yet; nothing is committed).
