# Table management and printable QR sheet (admin only)

Date: 06/10/2026

## Done
- `src/modules/tables/` (controller, service, `dto/`, module, unit tests in `__test__/`), registered in `src/app.module.ts`. Every route is `@Roles(UserRole.ADMIN)` and scoped to the caller's `branchId`; CSRF is required on POST/PATCH/DELETE as everywhere.
- `GET /api/tables`, `POST` (name), `PATCH /:id` (rename), `POST /:id/regenerate-qr`, `DELETE /:id` (204).
- `GET /api/tables/qr-pdf?columns=&rows=&ids=` returns an A4 PDF with only the QR codes in a grid (defaults 3x4, max 6x8; `ids` is a comma-separated subset, otherwise every branch table). It is a GET so the browser can download it with the session cookie and no CSRF token.
- Each QR encodes `{GUEST_APP_URL}/t/{qrToken}`. New env var `GUEST_APP_URL` (see `.env.example`, default `http://localhost:5176`).
- New dependencies: `pdfkit`, `qrcode` (+ types).

## Decisions
- Tokens are 24-char url-safe random strings (18 random bytes), not UUIDs.
- Table names are trimmed, 1-100 chars, unique per branch case-insensitively (409, checked in the service: no unique index).
- Deleting a table keeps its orders (`orders.tableId` is `SET NULL`), but any printed QR for it stops working.
- Regenerating a token invalidates the printed QR immediately.
- The PDF has no text on purpose (only QR codes were requested), so no font is embedded and Vietnamese names are not an issue.

## Verified
- `pnpm build`, `pnpm lint`, `pnpm test` (143 pass, including a multi-page PDF render).
- Not verified: authenticated calls against the database, and scanning a printed sheet.

## Pending
- A unique index on `(branchId, lower(name))`.
- Table labels on the sheet (needs a bundled Unicode font).
- The `ibb_sms` admin UI.
