# Stock import drafts (staff) with admin confirmation

Date: 19-10-2026. Builds on `docs/17102026/stock_imports.md` (instant, admin-only receipts).

## What was done
- Staff can draft an import with a photo of the invoice/goods. Stock changes only when an admin confirms.
- `ImportReceipt` gained `status` (`pending|confirmed|rejected`, default `confirmed` so old rows and admin imports are unchanged), `imageKey`, `rejectReason`, `reviewedByUserId`, `reviewedAt`. Migration: `src/database/migrations/1792400000000-ImportReceiptApproval.ts`.
- Endpoints (`src/modules/stock/stock.controller.ts`): staff/admin `GET items/options`, `GET suppliers`, `GET imports/mine`, `POST imports/drafts` (multipart: `image`, `lines` as JSON string, `supplierId`, `note`), `GET imports/:id/image`, `DELETE imports/:id` (pending only); admin `POST imports/:id/confirm` (optional `lines` to correct unit costs), `POST imports/:id/reject`.
- `StockService.postLines` is shared by instant imports and confirm; the ledger and locking rules in `stock-design-decisions` still apply.
- Finance summary now counts only `confirmed` receipts (`finance.service.ts`).

## Decisions
- Photo is stored in a new private bucket `import-receipts` and streamed through the backend (same reason as payment QR/attendance: no presigned URLs with the internal host). The backend creates the bucket on first draft; `ibb_shop_release/infra` init job also creates it.
- Staff see item names/units only (`items/options`), never quantities or `lastUnitCost`. Staff may type a unit cost from the invoice (optional, default 0); the admin can correct it on confirm.
- Staff only see/read/cancel their own drafts (others get 404). Confirmed receipts cannot be deleted; rejected ones stay as a record.
- One request creates the photo and the row; if the row write fails the object is removed.

## Verified
- Migration on a throwaway DB: run, revert, run; generator shows no diff for `import_receipts`.
- Service script on a throwaway DB with a stubbed S3: draft leaves stock unchanged, other staff blocked, concurrent confirm applies once, cost correction, reject keeps stock, cancel removes row and object.
- `tsc` clean outside tests, vitest suite passes (198).

## Pending
- Apply the migration to the dev DB `ibb` and to deployed environments.
- No unit tests for the new service methods; no HTTP test through the real controller/RustFS.
- Notifying admin of pending drafts (only a count in the Phiếu nhập tab for now).
