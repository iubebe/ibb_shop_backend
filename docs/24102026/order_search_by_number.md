# Order search by number

Date: 24/10/2026

## What was done
- `GET /api/orders/search?code=<3-8 hex>` (admin, staff): orders of the branch whose id starts with `code` (case-insensitive, any day), newest first, max 20. `OrderSearchQuery` strips a leading `#`. Service: `OrdersService.searchByNumber`, test in `orders.service.spec.ts`.
- "Order number" is the 8-char uppercase id prefix already printed as `Số` on the receipt; no new column or index (the branch's order volume is small; revisit if scans get slow).
- ibb_sms `/orders/history`: search input above the date controls. While a code is typed the date range, stats and list are replaced by the search results (all days). Cards now show `#NUMBER` next to the table name.

## Pending
- Prefix search is a sequential scan on `orders`; fine for now. Browser check of the UI not done (typecheck/build pass, SQL checked read-only on dev DB).
