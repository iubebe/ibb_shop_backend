# Staff shift proposals: auto-assign to the proposer

**Date:** 11/10/2026

Follows `docs/11102026/staff_shift_proposals.md`.

## What changed

- `POST /api/staff-schedules/proposals` now sets `assignedToUserId` to the staff member who proposed the shift. Before, it was left empty.
- Approval (`POST .../proposals/:id/approve`) keeps the assignment, so the shift becomes `scheduled` and stays with that staff member.
- Rejection (`POST .../proposals/:id/reject`) clears the assignment, so a rejected shift is not attached to anyone.
- Code: `src/modules/staff-schedules/staff-schedules.service.ts` (`proposeShifts`, `reviewProposal`).

No migration: `assignedToUserId` already exists on `staff_schedules`.

## Decisions

- **Approved proposals are not opened to other staff by this change.** Assignment and open-for-registration are separate fields: `assignedToUserId` says who takes the shift, `status` says whether it is open. An approved proposal is `scheduled`, so it still appears in the staff list and can still be registered for. Blocking registration on assigned shifts is not done here; it is a follow-up if you want it.
- **Admin assignment is unchanged.** Admins can still reassign through `PUT /api/staff-schedules/:id`, and approving a registration still overwrites `assignedToUserId`.
- **Cancelled proposals** (`POST .../proposals/:id/cancel`, added in commit `751700a`) keep their assignment field, but the status is `cancelled`, so the shift is not active.

## Verification

- `pnpm test`: 33 files, 192 tests pass. Updated in `staff-schedules/__test__/staff-schedules.service.spec.ts`: a proposal is assigned to its proposer, approval keeps the assignment, and rejection clears it.
- `pnpm build`: passes.
- `pnpm lint`: only the existing warning in `staff-schedules.controller.ts`.

Not run against the dev database.

## Pending / next steps

1. `ibb_sms`: the staff list shows an approved proposal under "Ca làm việc có sẵn" with a register button, even though it is assigned to its proposer. The UI could show it as "Ca của bạn" for the proposer, and hide it from others.
2. Decide whether registration should be blocked on shifts that already have an assignee.
