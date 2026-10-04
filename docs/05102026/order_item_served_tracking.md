# Serving progress per order item

Date: 05/10/2026

Follows [guest_api_and_demo_seed.md](./guest_api_and_demo_seed.md).

## Problem
Once an order is `confirmed` there was no way to know which products were already delivered to the table.

## Done
- `order_items.servedQuantity` (int, default 0, DB check `0 <= servedQuantity <= quantity`). Migration `src/database/migrations/1791200000000-OrderItemServedQuantity.ts` (applied to the local DB); entity `src/database/entities/order-item.entity.ts`.
- `src/modules/orders/` (`OrdersModule`, in `src/app.module.ts`), authenticated, branch-scoped:
  - `GET /api/orders?status=confirmed`: orders with table name and items (`id`, `quantity`, `servedQuantity`, `notes`). Roles: admin, staff, cashier.
  - `PATCH /api/orders/:orderId/items/:itemId/served` body `{ "servedQuantity": n }`. Roles: admin, staff. Needs the CSRF header.
- The guest orders endpoint now returns `servedQuantity` per item.
- Demo seed: the confirmed order of table 1 has Mẹt 3 Miền 1/1 and Nem lụi Huế 1/2 served.
- 86 tests pass, lint clean. Verified on the built app with a temporary staff user (deleted afterwards): list, set 2, set 3 -> 400, set 0, pending order -> 409, bad status filter -> 400, no auth -> 403 (CSRF) .

## Decisions
- Staff marks items served when they deliver them to the table (user decision); partial quantities are supported (user decision).
- The endpoint sets an absolute count instead of "+1": retries are harmless and a mistake can be undone by lowering it. The row is locked in a transaction so two staff can't interleave.
- Only `confirmed` orders can be served (409 otherwise). The order status is unchanged: "fully served" is derived (every item `servedQuantity = quantity`); `paid` stays a separate POS step.
- Cashiers can read the list but not change serving.
- Works with a future running tab: added items start at 0 served.

## Pending / next
- No WebSocket event yet. Guests can't use the WebSocket (it requires the staff access cookie), so the guest app polls every 15 s. Staff screens should get an `order:updated` event on the authenticated socket.
- No audit log of who served what and when (a `StockMovement`-style table, if needed).
- Staff UI in `ibb_sms` (see its docs), POS warning at checkout when items are unserved.
- Cancelling/reducing a line after it was partly served is not handled.
