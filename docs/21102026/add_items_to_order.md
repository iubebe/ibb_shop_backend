# Add items to an open order — 21/10/2026

## Done
- `POST /api/orders/:orderId/items` (admin, staff) in `src/modules/orders/orders.controller.ts`; body `{ items: [{ productId, quantity, notes? }] }` (`dto/add-order-items.dto.ts`).
- `OrdersService.addItems` (`orders.service.ts`): one transaction, order row locked.
- Tests in `src/modules/orders/__test__/orders.service.spec.ts`.

## Decisions
- Allowed for `pending_confirmation` and `confirmed` orders; paid/cancelled give 409.
- A product already on the order with the same `unitPrice` snapshot is merged into its line (quantity grows, `servedQuantity` kept, notes appended). If the product price changed since, a new line is added so old lines keep their price.
- `order.total` is recomputed from all lines.

## Pending
- No `order:updated` WebSocket event yet (clients rely on polling).
- Not exercised against a real DB or in the browser.
- Cashier cannot add items (UI hides the button, API forbids it).
