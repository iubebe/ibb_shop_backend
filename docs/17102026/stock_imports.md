# Stock imports (goods and materials) — 17/10/2026

## What was done
New admin-only module `src/modules/stock` under `/api/stock`:
- **Items** (`stock_items`): goods or materials with a free-text unit, decimal quantity (3 dp), low-stock threshold, last import unit cost, `isActive`. CRUD plus `POST items/:id/adjust` (stocktake/waste, signed change, note required) and `GET items/:id/movements`.
- **Suppliers**: simple CRUD. Deleting one keeps old receipts (link set to null).
- **Imports** (`import_receipts` + `import_receipt_lines`): `POST /stock/imports` records a receipt and adds stock **immediately** (no draft step, per the decision). `GET /stock/imports?from&to` lists `[from, to)` (max 93 days), `GET /stock/imports/:id`.
- **Ledger** (`stock_item_movements`, append-only): every quantity change, with `quantityAfter`, reason (`import` | `adjustment`), receipt and user.

Entities in `src/database/entities`, migration `1792227058378-StockImports.ts` (hand-trimmed from the generated output, tested up/down/up on a throwaway DB).

## Decisions
- Separate from the existing `InventoryItem`/`StockMovement` (product-level, integer, unused): materials need decimals, units and suppliers. Those two entities are left untouched.
- Quantity changes only through `StockService.applyMovement`, inside a transaction with `pessimistic_write` row locks (taken in id order to avoid deadlocks). Stock can never go below zero.
- Receipt codes `PN-YYYYMMDD-NNN` per branch and day, serialized with a Postgres advisory transaction lock; unique index on `(branchId, code)`.
- Items with history can't be deleted (409): deactivate instead. Inactive items can't be imported.
- Admin only: costs are hidden from staff/cashier, same as revenue.

## Verified
`pnpm build`, lint, and a script against a throwaway Postgres: multi-line import, decimal math, duplicate-name and over-withdrawal errors, rollback on unknown item, 10 parallel imports (unique codes, correct total).

## Not done / next
- No unit tests in `__test__/` yet; no HTTP-level check with a logged-in admin (no password at hand).
- Migration not applied to the dev DB `ibb` (`pnpm migration:run`).
- Void/reverse a receipt, selling-side deduction (recipes), CSV/Excel export, link goods to menu products.
- UI: see `ibb_sms/docs/17102026/stock_ui.md`.
