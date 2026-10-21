# Surplus stock: write-offs and at-risk detection — 21/10/2026

Goal: stock that does not sell and then spoils must be written off, and the loss must show in finance.

## Done
- Entity `WriteOff` (`src/database/entities/write-off.entity.ts`), `WriteOffCause` / `WriteOffStatus` enums, `StockItemMovementReason.WRITE_OFF`, `StockItem.shelfLifeDays`.
- Migration `src/database/migrations/1792545309532-WriteOffs.ts` (hand-trimmed from the generated one; run, revert, run checked on a throwaway DB).
- `WriteOffService` / `WriteOffController` under `src/modules/stock` (`stock/write-offs`):
  - `GET at-risk`, `GET pending`, `GET ?from&to` (admin); `GET mine` (admin, staff).
  - `POST` admin writes off at once; `POST proposals` staff proposes; `POST :id/confirm` (optional corrected `quantity`) and `POST :id/reject` (admin); `DELETE :id` withdraws a pending proposal (author or admin).
- Stock goes down only through `StockService.applyMovement` (now public, with `lockItem`), so the ledger stays complete. Item `shelfLifeDays` is editable through the existing item endpoints.
- Finance: `totals.writeOffLoss` and `daily[].writeOffLoss` in `GET /api/finance/summary`.
- Tests: `src/modules/stock/__test__/write-off.service.spec.ts` (216 backend tests pass). The service was also run against a throwaway DB: direct, propose/confirm/reject/withdraw, over-quantity rollback, 10 concurrent write-offs on 5 units (exactly 5 succeed), concurrent confirm applies once, finance figure.

## Decisions
- Admin acts directly; staff only propose. Staff never see costs (their views return `unitCost`/`totalCost` as null).
- Cost is a snapshot of the item's `lastUnitCost` when the write-off is confirmed (0 if unknown); the loss date is `writtenOffAt`.
- `writeOffLoss` is shown separately and is NOT added to `totalCost`: imports are already counted as cash-basis cost, so adding it would count the same money twice.
- At-risk is an estimate without batches: expiry = latest confirmed import + `shelfLifeDays`; "expiring soon" = within 3 days; "stale" = 14 days with no outflow (falling back to last import, then creation date). Constants live in `write-off.service.ts`. Sales do not deduct stock, so "stale" only sees adjustments and write-offs as outflow.

## Pending
- Migration not applied to the dev DB `ibb`.
- No per-batch (FIFO) lots, so one expired batch cannot be told apart from newer stock.
- Thresholds are constants, not settings.
- `ibb_shop_release` version bump.
