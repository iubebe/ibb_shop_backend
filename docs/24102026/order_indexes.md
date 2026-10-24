# Order indexes

Date: 24/10/2026

## What was checked
Index list of every table on the dev DB (all tiny, so planner stats say nothing) against the query patterns in the services. Verified on a throwaway DB with 300k generated orders for one branch (`EXPLAIN ANALYZE`).

## Added (migration `1793000000000-OrderIndexes.ts`, named in `order.entity.ts`)
- `IDX_orders_branch_createdAt (branchId, createdAt)`: order history by day range, dashboard recent orders. Before: parallel seq scan + sort. After: backward index scan, 0.16 ms.
- `IDX_orders_branch_status_paidAt (branchId, status, paidAt)`: revenue/top-products on dashboard and finance (daily, by payment method). Before: seq scan, ~28 ms at 300k rows. After: index scan, 0.2 ms.

## Changed
- Order search by number (`searchByNumber`) now filters `id BETWEEN lo::uuid AND hi::uuid` (`uuidRange`), served by the primary key. The old `id::text ILIKE 'x%'` forced a seq scan on every search.

## Looked at, not added
- `expenses`, `write_offs`, `import_receipts`, `investments`: separate single-column `branchId` and date indexes; these tables grow slowly. A composite `(branchId, date)` is the first thing to add if finance pages slow down.
- `customers` search (`ILIKE '%q%'` on name/phone/address) cannot use a btree; would need `pg_trgm`. Not worth it at current size.
- Existing `(branchId, status)` on orders still serves the live queue (`status` filter).

## Pending
- Migration is not applied to the dev DB `ibb` (only run/verified on the throwaway DB, since dropped). On a large production table, `CREATE INDEX` locks writes while it builds; at current size it is instant.
