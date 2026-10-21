# Guest orders: optional customer info

Date: 21-10-2026

Follow-up to `customer_management.md` (same folder).

- `POST /api/guest/.../orders` (`src/modules/guest/dto/create-order.dto.ts`) accepts optional `customerName`, `customerPhone`, `customerAddress`, validated like the staff DTO.
- Guest input is unauthenticated, so the order only stores the typed info. The `customers` record is created/linked when staff confirm the order (`OrdersService.confirm`). This stops anyone from changing an existing customer's name/address just by typing their phone.
- Until confirmed, staff can already see the info on the pending order and edit it (`PATCH /orders/:id/customer`).
- Unchanged from before: phone identifies a customer, orders keep their own copy, paid and cancelled orders are locked for customer edits.
