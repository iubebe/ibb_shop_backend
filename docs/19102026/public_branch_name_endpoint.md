# Public branch name endpoint

Date: 19-10-2026

## Done
- Added `GET /api/branch/public` (`@Public()`) in `src/modules/branches/branches.controller.ts`, backed by `BranchesService.getPublicName()`.
- Returns only `{ name }` of the oldest branch (one business per deployment). No id or address is exposed.

## Why
ibb_sms needs the shop name on the login page and in the tab title before sign-in; `GET /api/branch` requires a session.

## Pending
- Unit test for `getPublicName` in `__test__/branches.service.spec.ts`.
- Not yet run against a live DB.

See also `ibb_sms/docs/19102026/branch_name_login_title.md`.

## Update: CSRF + rate limit
- `GET /api/branch/public` now needs the CSRF token (cookie + `X-CSRF-Token`), via new `@RequireCsrf()` (`src/auth/decorators/require-csrf.decorator.ts`) honored by `CsrfGuard` on safe methods; guard test added in `src/auth/__test__/guards.spec.ts`.
- It also has `@StrictThrottle()` (default 10/min per IP, then blocked 60s; tune with `THROTTLE_STRICT_LIMIT`). Guests share the shop Wi-Fi IP, so watch for 429s at peak; the title falls back to the static one.
- `ibb_sms` and `ibb_shop_guest` `src/api/client.ts` now attach the CSRF header for this route.

## Update: Redis cache
- `BranchesService.getPublicName()` caches `{ name }` under `REDIS_KEY.BRANCH_PUBLIC_NAME` (`branch:public-name`) for 30 min; `update()` deletes the key on rename. A missing branch is not cached.
- Redis errors are not swallowed (same as the guest menu cache), so a Redis outage makes this endpoint fail; the frontends then keep their static title.
- Not run against a live Redis.

## Update: Redis cache
- `BranchesService.getPublicName()` caches `{ name }` under `REDIS_KEY.BRANCH_PUBLIC_NAME` (`branch:public-name`) for 30 min; `update()` deletes the key on rename. A missing branch is not cached.
- Redis errors are not swallowed (same as the guest menu cache), so a Redis outage makes this endpoint fail; the frontends then keep their static title.
- Not run against a live Redis.
