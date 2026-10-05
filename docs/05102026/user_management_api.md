# User management API

Date: 05/10/2026

## What was done

Admin-only CRUD for accounts in `src/modules/users/` (controller, service, `dto/`, `__test__/`), all scoped to the caller's branch.

- `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `POST /api/users/:id/reset-password`, `DELETE /api/users/:id`.
- New column `users.isActive` (migration `1791214134791-AttendanceRecords.ts`, shared with [attendance_api.md](./attendance_api.md)).
- `AuthService` rejects disabled users at login ("Account is disabled", only after the password is correct) and at refresh (the session is revoked). `AuthModule` now exports `RefreshTokenStore` so the users module can end sessions.

## Decisions

- New and reset passwords are temporary: `mustChangePassword = true`. The length rule is the existing `assertValidNewPassword` (10-128).
- Emails are stored lowercase; uniqueness is checked case-insensitively (409), matching how login looks users up.
- An admin cannot change their own role, disable, delete or reset themselves. That also guarantees at least one active admin remains.
- A user with attendance history cannot be deleted (409): disable instead. This mirrors the product rule in [product_category_crud.md](./product_category_crud.md).
- Disabling, changing the role, resetting the password or deleting revokes the user's refresh sessions.

## Limits / pending

- The access token is a stateless JWT (15 min). A disabled or demoted user keeps their old access until it expires; only refresh is blocked. Closing that gap needs a per-request check against Redis or the DB.
- No audit log of who changed which account.
- The `ibb_sms` UI is documented in the `ibb_sms` repo.
