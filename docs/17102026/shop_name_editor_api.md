# Shop name editor API — 17/10/2026

## Decision
One business = one deployment; a second business gets its own deployment (own DB and domain). So the shop name is simply the caller's `branches.name`; no tenant layer, no branch switcher on login. See also `order_item_unit_price.md`.

## Done
- New `src/modules/branches/`: `GET /api/branch` (admin, staff, cashier) returns `{ id, name, address }` of the caller's branch; `PATCH /api/branch` (admin) takes `{ name (1-100, trimmed), address? (<=255; "" clears) }`.
- Saving busts the guest menu cache (`GuestService.revalidateMenuCache`) because the menu now embeds `shopName`.
- `GuestMenuView.shopName` added; read from `branches` on cache miss via `dataSource.getRepository(Branch)` (keeps the GuestService constructor unchanged).
- No migration (columns already existed). Spec: `branches/__test__/branches.service.spec.ts`.

## Verification
tsc clean outside specs; unit tests pass. 4 existing S3-related specs (attendance, payment-qr-codes) fail with or without this change. Not run against a live DB/HTTP.

## Pending
Public name endpoint for the login page (login keeps static "SMS"/"POS" branding for now). Phone/tax-ID/receipt footer fields would need a migration.
