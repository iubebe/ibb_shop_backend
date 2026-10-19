# Redis cache for products

Date: 19-10-2026

## State found
- `GET /api/guest/tables/:qrToken/menu` (the guest products) was already cached per branch (`guest:menu:<branchId>`, 30 min) and dropped on product, category and branch changes.
- `GET /api/products` (admin/staff list) was not cached.

## Done
- `ProductsService.list` caches the whole branch list under `product:list:<branchId>` (30 min, `REDIS_KEY.PRODUCT_LIST`); the `categoryId` filter is applied in memory on top of it, so there is one key per branch.
- New `GuestService.revalidateProductCaches(branchId)` drops both the guest menu and the admin list. Called after product create/update/remove, image upload/remove, and category removal (its products become uncategorized). Category create/rename still only drop the menu (the product list holds no category names).
- Bug fix: image upload and image removal previously did not drop the guest menu cache, so guests could see an old image for up to 30 min.
- Tests: `src/modules/products/__test__/products.service.spec.ts` (list cache, filter, invalidation on every write); mocks updated in `categories.service.spec.ts`.

## Decisions
- Redis errors are not swallowed (same as the menu cache).
- Products are only written through the API (orders only read them), so every write path invalidates.

## Pending
- Not run against a live Redis.
- `src/modules/guest/__test__/guest.service.spec.ts` has an existing type error (constructor args), untouched.
- Direct DB edits or seeds do not invalidate; wait 30 min or `DEL product:list:<branchId>`.

See `ibb_sms/docs/19102026/product_cache_check.md` and `ibb_shop_guest/docs/19102026/product_cache_check.md`.
