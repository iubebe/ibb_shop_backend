# Order item unit price in StaffOrderView — 17/10/2026

Receipts need per-item prices. `StaffOrderView.items[]` (`src/modules/orders/orders.types.ts`) now includes `unitPrice` (the price snapshot stored on the order item). Added in every place `orders.service.ts` builds the view. Additive, no migration; orders specs pass.

Used by: `ibb_sms/docs/17102026/receipt_preview_print.md`.
