# Order import from Excel + import template

**Date:** 10/10/2026

## What was done

Staff and admin can download an Excel template and upload a filled sheet to create many confirmed orders at once.

- `GET /api/orders/import/template`: `.xlsx` with the header row, a guide sheet, and two reference sheets listing the caller's branch tables (`Bàn`) and active products (`Món`). Names are copied from the database so they can be pasted directly.
- `POST /api/orders/import`: multipart upload, field `file`, `.xlsx` only, 2 MB max. Creates one confirmed order per distinct order key, in a single transaction.

Code lives in `src/modules/orders/order-import/`:
- `order-import.constants.ts`: column headers, limits.
- `order-import.excel.ts`: reads the workbook and builds the template (ExcelJS).
- `order-import.service.ts`: resolves tables and products, groups rows, writes orders.
- `order-import.controller.ts`: the two routes. Kept separate from `OrdersController` so its constructor and specs stay unchanged.
- `__test__/`: parser and service specs.

Registered in `orders.module.ts`.

## Sheet format

| Column | Required | Rule |
|---|---|---|
| Mã đơn | yes | Rows with the same value form one order (max 50 lines). |
| Bàn | yes | Must match a table name. All rows of one order must use the same table. |
| Món | yes | Must match an active product name. |
| Số lượng | yes | Integer 1–99. |
| Ghi chú | no | Max 200 characters. |

Matching of table and product names ignores case, Unicode normalization, and extra spaces.

## Decisions

- **All or nothing.** Every row is validated first. If any row fails, nothing is written and the response lists the row errors (capped at 100, with the total count). This avoids half-imported orders that staff would have to clean up.
- **Same rules as manual orders.** Confirmed status, `createdByUserId` set to the uploader, total computed from database prices, duplicate products on one order merged with notes joined by `; `. Matches `OrdersService.createOrder`.
- **Ambiguous names are errors.** If two active products (or two tables) share a name in the branch, a row that uses that name is rejected instead of guessing.
- **Product lookup by name, not by id.** The product table has no SKU or code column, so the template uses the name shown in the `Món` sheet.
- **Limits:** 2 MB file, 2000 data rows, 200 orders per file, 50 lines per order.
- **Roles:** admin and staff, same as manual order creation. Cashier is excluded.
- **Not reused:** `createOrder` was not refactored to share its insert code. Its specs mock the exact save call shape, and changing it was out of scope. The import writes orders with batched `save` calls.

## Verification

- `pnpm build`: passes.
- `pnpm test`: 30 files, 169 tests pass (11 new in `order-import/__test__/`).
- `pnpm lint`: only the pre-existing warning in `staff-schedules.controller.ts`.
- Boot check: built app started on port 3100. `GET /api/orders/import/template` returns 401 without a session. `POST /api/orders/import` returns 403 (CSRF). Both routes are registered and the module wires up. The process was stopped and the port freed.

**Not verified:** a real logged-in upload and download. Running it would create orders in the dev DB, so it needs a throwaway database or your go-ahead.

## Pending / next steps

1. Frontend: a template download button and an upload dialog in `ibb_sms`, showing the row-error list. Not started.
2. End-to-end run against a throwaway DB with a logged-in user (template download, a valid import, an import with errors).
3. Consider a dry-run mode (validate only). Not added; the row-error response already covers most of its purpose.
4. Commit and release bump (`ibb_shop_release`) once the frontend is in place.

## Related

- Order creation and models: `src/modules/orders/orders.service.ts`
- Attendance Excel export uses the same ExcelJS approach: `src/modules/attendance/attendance-report.service.ts`
