# Order control and checkout API

Date: 06-10-2026

## What was done

Three status transitions were added to `src/modules/orders/` so reception can control orders and the cashier can check out. They build on the serving endpoint from `docs/05102026/` (see `order_served_tracking` notes in the repo history).

| Endpoint | Roles | From -> to | Notes |
|---|---|---|---|
| `POST /api/orders/:orderId/confirm` | admin, staff | pending_confirmation -> confirmed | sets `confirmedAt` |
| `POST /api/orders/:orderId/cancel` | admin, staff | pending_confirmation or confirmed -> cancelled | paid orders cannot be cancelled |
| `POST /api/orders/:orderId/pay` | admin, cashier | confirmed -> paid | body `{ paymentMethod: "cash" \| "qr_manual" }`; sets `paymentStatus`, `paidAt` |

All three run in a transaction under a row lock (`OrdersService.transition`) and return `409` when the current status does not allow the move, so a double tap or retry is rejected instead of applied twice. Everything is scoped by the caller's `branchId` (`404` otherwise). `GET /api/orders` is unchanged.

## Decisions

- Cash change is computed in the UI only; the backend stores the method, not the amount received.
- Checkout does not require every item to be served. The UI warns, the API allows it.
- No stock movement is written on payment yet (inventory is not wired to orders).
- No WebSocket `order:updated` event; the UI polls every 15 s, as for the dashboard.

## Verification

- Unit tests in `src/modules/orders/__test__/orders.service.spec.ts`; `pnpm test`, `pnpm build`, `pnpm lint` pass.
- Booted the built app on port 3100 against throwaway Postgres/Redis containers (both removed, process stopped). With curl as admin, staff and cashier: role limits (cashier cannot confirm, staff cannot pay), 409 on wrong status and double pay/confirm, 400 on a bad method, 404 on an unknown order, DB columns correct, dashboard revenue counted the paid order.
- The dev DB was not touched.

## Pending

- `order:updated` WebSocket event; stock deduction on sale; audit log of who confirmed/paid; payment QR image display (upload is not built, see S3 docs).
- Changes are uncommitted.

UI: `ibb_sms/docs/06102026/order_control_checkout_ui.md`.
