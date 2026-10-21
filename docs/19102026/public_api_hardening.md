# Hardening the public APIs

Date: 19-10-2026

## Public endpoints reviewed
- `GET /api/branch/public`: CSRF token + strict rate limit + Redis cache (see `public_branch_name_endpoint.md`).
- `/api/guest/tables/:qrToken/*`: already had a 144-bit random `qrToken` as credential, CSRF on POST, DTO limits (max 50 lines, qty 1-99, notes 200), prices read from the DB, global per-IP burst/sustained throttle.
- `/api/health`, `/api/version`, `GET /api`: unchanged.

## Done
- `GuestService.createOrder` refuses a new order with 429 when the table already has 5 orders in `pending_confirmation` (`MAX_PENDING_ORDERS_PER_TABLE`). Chosen over a per-route IP limit because guests share the shop Wi-Fi IP and would block each other.
- `GET/POST .../orders` send `Cache-Control: no-store` (table orders must not sit in a shared cache).
- Tests in `src/modules/guest/__test__/guest.service.spec.ts` (also fixed its stale constructor mock, which removed the earlier type error).

## Not done / pending
- No per-IP limit on token probing (random `qrToken` guesses cost a DB lookup each; the global 600/min per IP applies). A format check on the token was skipped because the demo seed uses its own token format.
- `/api/version` exposes commit and build time; restrict it if that is unwanted.
- The cap counts pending orders only; staff confirming frees the slot. Tune `MAX_PENDING_ORDERS_PER_TABLE` if 5 is wrong.
- Not run against a live DB/Redis; the guest UI's display of the 429 message is unchecked.
