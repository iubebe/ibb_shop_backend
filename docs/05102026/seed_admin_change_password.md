# Seed admin + first-login password change

Date: 05/10/2026

Follows `setup_auth.md` (it listed "no way to create users" as pending).

## Done
- `src/database/seed.ts`, run with `pnpm db:seed` (builds first). Creates the default branch and the first admin. Idempotent: an existing admin (matched by email, case-insensitive) is never modified, so re-running is safe.
- Env (`.env.example`): `SEED_ADMIN_EMAIL` (required), `SEED_ADMIN_NAME`, `SEED_ADMIN_PASSWORD`, `SEED_BRANCH_NAME`. If `SEED_ADMIN_PASSWORD` is empty a random password is generated and printed once.
- New column `users.mustChangePassword` (migration `UserMustChangePassword`). The seeded admin has it set.
- `POST /api/auth/change-password` `{ currentPassword, newPassword }` (needs CSRF + login). New password: 10-128 chars, different from the current one (`src/auth/password-policy.ts`). On success it clears the flag, revokes every session of that user and starts a fresh one (new cookies).
- While the flag is set, the access token carries `mcp: true`, and `AuthGuard` returns 403 "Password change required" for every route except those marked `@AllowWhenPasswordChangeRequired()` (`change-password`, `me`; `login`, `refresh`, `logout`, `csrf` are public). WebSocket connections are refused until the password is changed.
- Login/refresh/me responses now include `user.mustChangePassword` so frontends can redirect to a change-password screen.

## Verified
Seeded twice (second run no-op), logged in (`mustChangePassword: true`), `me` allowed, wrong current 401, too short 400, unchanged 400, change OK (flag false), old session refresh 401, old password 401, new password 200. 66 unit tests pass.

## Decisions
- Flag is carried in the token and re-read from the DB on refresh, so it is enforced without a DB hit per request.
- Local DB state: seeded admin `admin@ibb.local` exists and its password was already changed during testing (the temporary one no longer works). Delete the row and re-run `pnpm db:seed` for a fresh one.

## Pending / next
- No admin API to create other users (staff/cashier) or to force-reset someone's password; when added, set `mustChangePassword: true` the same way.
- No "forgot password" flow (no email provider chosen).
- Login is still not rate limited.
