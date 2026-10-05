# Product and category CRUD (admin only)

Date: 05/10/2026

## Done
- `src/modules/categories/` and `src/modules/products/` (controller, service, DTOs, module, unit tests in `__test__/`), registered in `src/app.module.ts`. Every route is `@Roles(UserRole.ADMIN)` and scoped to the caller's `branchId`; CSRF is required on POST/PATCH/DELETE as everywhere.
- Categories: `GET /api/categories` (with `productCount`), `POST`, `PATCH /:id`, `DELETE /:id` (204). Name 1-100 chars, trimmed, unique per branch case-insensitively (409), checked in the service because the schema has no unique index. Deleting keeps the products, which become uncategorized (existing FK `SET NULL`).
- Products: `GET /api/products?categoryId=` (inactive ones included, unlike the guest menu), `POST`, `PATCH /:id`, `DELETE /:id` (204). Name 1-150, `price` whole VND 0..100,000,000, `categoryId` must belong to the branch (400) and may be `null`, `imageUrl` http(s) URL or `null`/empty string to clear, `isActive` default true. PATCH only changes provided fields.
- Deleting a product that appears in orders returns 409 ("deactivate it instead"): `order_items.productId` is `RESTRICT` so order history stays intact. Deactivating (`isActive: false`) hides it from the guest menu.

## Verified
- `pnpm build`, `pnpm lint`, `pnpm test` (97 pass). Booted `dist/main` on port 3100: health ok, all 8 routes mapped, unauthenticated calls return 401. The category count SQL was run read-only against the dev database.
- Not verified: authenticated create/update/delete against the database (no admin password at hand).

## Pending
- Image upload (only a URL is stored), a `sortOrder` column (menu order is still `createdAt`), a WebSocket/cache signal so open guest menus refresh, a unique index on `(branchId, lower(name))` for categories.

Frontend: see `ibb_sms/docs/05102026/product_category_admin.md`.
