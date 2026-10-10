# Staff shift proposals (staff proposes, admin approves)

**Date:** 11/10/2026

## Why

Only admins could create shifts. Staff could only register for shifts an admin had already created. The decision: staff can propose shifts, and an admin approves them before they become open shifts. This reuses the existing approve/reject pattern.

## What was done

**Status flow** on `staff_schedules.status`:

`proposed` → `scheduled` (admin approves; open for registration) or `rejected` (admin rejects; the proposer still sees it with the notes).

Admin-created shifts still start as `scheduled`, so existing behavior is unchanged.

**Endpoints** (`src/modules/staff-schedules/staff-schedules.controller.ts`):

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/staff-schedules/proposals` | staff | propose one or more shifts (same body as admin create) |
| GET | `/api/staff-schedules/proposals/mine/:weekStartDate` | staff | own proposals for the week |
| GET | `/api/staff-schedules/proposals/by-week/:weekStartDate` | admin | all proposals for the week |
| POST | `/api/staff-schedules/proposals/:scheduleId/approve` | admin | approve, body `{ notes? }` |
| POST | `/api/staff-schedules/proposals/:scheduleId/reject` | admin | reject, body `{ notes? }` |

**Visibility.** `GET /api/staff-schedules` and `GET /api/staff-schedules/:scheduleId` now take the viewer into account. Staff see `scheduled` shifts plus their own proposals (any status). They don't see other staff members' proposals, and a direct request for one returns 404. Admins see everything.

**Data.** Migration `1791654554824-StaffShiftProposals.ts` adds `proposedByUserId`, `reviewedByUserId`, `reviewedAt` and `reviewNotes` to `staff_schedules`, plus the FKs and an index on `proposedByUserId`. Existing rows and their `status` values are untouched.

## Decisions

- **The proposer is not auto-registered.** An approved proposal becomes an open shift that anyone can register for, the same as an admin-created one. If the proposer should get the shift automatically, that is a follow-up.
- **Rejected proposals are kept**, not deleted, so the proposer can see the reason.
- **Reviewing only applies to `proposed`.** Approving or rejecting anything else returns 409.
- **Registration is blocked until approval.** The existing check (`status` must be `scheduled`) already covers this.
- **Admin edit and cancel are unchanged.** An admin can still edit a proposal directly or cancel a shift.

## Fix found on the way

`ShiftInputDto` had no class-validator decorators. With the global `ValidationPipe` (`whitelist` and `forbidNonWhitelisted`), every valid shift was rejected, so admin shift creation could not have worked. The DTO now validates `dayOfWeek` (1–7), `startTime`/`endTime` (HH:mm), and the length of `shiftType` and `position`. A DTO test covers this (`__test__/staff-schedules.dto.spec.ts`).

## Verification

- Migration applied to a throwaway database (`ibb_migtest`, now dropped), reverted, and re-applied. Columns confirmed with `\d staff_schedules`.
- The generated migration was discarded. It would have dropped and recreated the `status` column, which would erase existing values, and it would have dropped the served-quantity CHECK constraint. The written migration includes only the new columns.
- `pnpm build`: passes.
- `pnpm test`: 33 files, 191 tests pass. New: 13 in `staff-schedules/__test__/` (service visibility, proposal creation, review transitions, registration gating) plus 2 DTO tests.
- `pnpm lint`: only the existing warning on `rejectRegistration`.
- Boot check on port 3100: the new routes respond 401 without a session. POST routes return 403 from the CSRF guard. The process was stopped and the port freed.

**Not verified:** a logged-in propose → approve flow over HTTP. That would write to the dev database, so it needs your go-ahead or a throwaway environment.

## Pending / next steps

1. `ibb_sms`: staff "propose shift" form, and an admin review queue (approve/reject with notes). The backend contract is above.
2. Staff `ibb_sms` shift list should show proposals with their status.
3. Decide whether proposers should be auto-registered (see Decisions).
4. Possible abuse guard: a limit on how many open proposals one staff member can have. Not added.
5. Commit and release bump once the UI exists.

## Related

- Original design: `docs/10102026/staff_schedules_backend.md`
- Earlier memory note on this feature: `staff_schedules_feature_complete` (memory)
