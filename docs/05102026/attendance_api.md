# Attendance (face-photo check-in) API

Date: 05/10/2026

## What was done

`src/modules/attendance/` plus entity `AttendanceRecord` (`attendance_records`) and migration `1791214134791-AttendanceRecords.ts`.

Staff and cashier (admin gets 403):
- `POST /api/attendance/check-in` and `POST /api/attendance/check-out`: multipart, field `photo`, JPEG only, max 1 MB (magic bytes are checked, not the header).
- `GET /api/attendance/me`: state (`idle` / `checked_in`), today's and this month's totals, last 10 records.

Admin:
- `GET /api/attendance?month=YYYY-MM[&userId]`: sessions of a month.
- `GET /api/attendance/report?month=`: per-person days, sessions, worked minutes, forgotten check-outs.
- `GET /api/attendance/report/export?month=`: `.xlsx` with a summary sheet and a detail sheet (Vietnamese headers, hours with 2 decimals, times in `SHOP_TIMEZONE`).
- `GET /api/attendance/:id/photo/:kind` (`check-in` | `check-out`): streams the photo through the backend, so the bucket stays private and access is admin-only.
- `PATCH /api/attendance/:id`: correct times (e.g. close a forgotten check-out). Stores `adjustedAt` and `adjustedByUserId`.

## Decisions (from the user, 05/10/2026)

- Face check-in is simple: capture a photo and queue it for face detection later. No matching is done now.
- One record is a check-in/check-out pair, each with its own photo.
- Salary is an hours report with a monthly Excel export; no pay rates are stored.

## Design notes

- Face queue: `FaceQueueService` does `LPUSH` of a JSON job to the Redis list `attendance:face-queue` (`REDIS_KEY.ATTENDANCE_FACE_QUEUE`). Job fields: `recordId`, `userId`, `kind`, `photoKey`, `enqueuedAt`. The future worker should `BRPOP` it and write `checkInFaceStatus` / `checkOutFaceStatus` (`pending` -> `passed` | `failed`). The DB status is the source of truth, so a lost push can be re-queued by sweeping `pending` rows. A queue failure never blocks a check-in.
- Photo keys: `attendance/<branchId>/<userId>/<recordId>-in|out.jpg` in the default bucket.
- A session open longer than 16 h (`MAX_SHIFT_HOURS`) counts as a forgotten check-out: it is flagged `incomplete`, adds no hours, and no longer blocks a new check-in. Admin fixes it with PATCH (max 24 h per session, no future times).
- A session belongs to the month (shop timezone) of its check-in; only completed sessions count towards hours.
- Check-in/out lock the user row inside a transaction, so double taps cannot create two open sessions. A photo uploaded by a losing request is deleted.

## Verified

Against throwaway Postgres 17, Redis 7 and RustFS containers (removed afterwards), with the built app on port 3100: migrations run and `migration:generate` shows no further diff; real uploads and photo read-back (bytes identical); queue jobs in Redis; 5 parallel check-ins gave 1 success and 4 conflicts with no orphan objects; report, Excel export (valid xlsx), adjust rules, permission checks, CSRF and size/format rejections. The Excel file contents were not opened in Excel. Unit tests cover the services; 137 tests pass.

## Pending

- Face-detection worker (consumer of the queue) and the re-queue sweep.
- The migration has not been run on the dev database (`pnpm migration:run`).
- Pay rates / salary calculation, manual creation of a missing session, an admin screen to review face results.
- `ibb_sms` UI, and a version bump in `ibb_shop_release`.
- Nothing is committed.
