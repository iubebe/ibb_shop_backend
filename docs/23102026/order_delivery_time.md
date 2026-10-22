# Order delivery time (online orders)

Date: 23/10/2026

## Done
- New nullable `orders.deliveryAt` (timestamptz): `src/database/entities/order.entity.ts`, migration `src/database/migrations/1792700000000-OrderDeliveryAt.ts`.
- `POST /api/orders` and the order-customer edit endpoint accept optional `deliveryAt` (ISO string, `null` clears). `StaffOrderView` returns it.
- Only orders on the table named "Online" (`src/modules/orders/online-table.ts`) may carry it; any other table gets 400.
- ibb_sms receipt prints "Giao lúc" for online orders (see `ibb_sms/docs/23102026/order_delivery_time.md`).

## Pending
- Migration not yet applied/verified on a DB; no new unit tests for the 400 rule; UI not checked in a browser at 390px.
- Guest orders and order Excel import don't set `deliveryAt`.
- Bump backend and ibb_sms versions in `ibb_shop_release`.
