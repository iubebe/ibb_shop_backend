# Payment QR codes: admin upload and management API

**Date:** 11/10/2026

## What was done

Admins can now upload, rename, enable/disable, replace and delete the transfer QR images shown at checkout. Before this, the only route was a read-only `GET /api/orders/payment-qr-codes`, and rows could only be added by hand in the database.

New module `src/modules/payment-qr-codes/` (registered in `app.module.ts`):

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/payment-qr-codes` | — | all codes in the branch, including inactive ones |
| POST | `/api/payment-qr-codes` | multipart: `image` (file) + `label` | 201 with the new row, `isActive: true` |
| PATCH | `/api/payment-qr-codes/:id` | JSON: `label?`, `isActive?` | updated row |
| POST | `/api/payment-qr-codes/:id/image` | multipart: `image` | row with the new image; old object deleted |
| DELETE | `/api/payment-qr-codes/:id` | — | 204 |

Admin only, branch-scoped (a code in another branch returns 404).

The read endpoint `GET /api/orders/payment-qr-codes` is unchanged. It still returns active codes for staff and cashier.

## Decisions

- **Storage is S3**, like product images. The key is `payment-qr/<branchId>/<uuid>.<ext>` and the object is cached as immutable, since each upload gets a new key.
- **Image type is checked from the bytes** (JPEG, PNG or WebP, max 5 MB), reusing `products/product-image.ts`. A PNG renamed to `.jpg` is stored as PNG.
- **Column name `imagePath` is kept.** `ibb_sms` and `ibb_shop_pos` already read `imagePath` from the read endpoint and use it as an `<img src>`. It now holds the public S3 URL, so no migration is needed and the frontends don't change. The entity comment was updated to say so.
- **Upload then row, with cleanup.** The object is uploaded first. If the row save fails, the object is deleted. On replace or delete, the old object is removed after the row changes.
- **Delete is a hard delete.** Orders store only `paymentMethod`, not a reference to the code, so there is no order history to protect. Use `isActive: false` to hide a code without deleting it.
- **Sort order** is `createdAt` ascending, as in the existing read endpoint.

## Verification

- `pnpm build`: passes.
- `pnpm test`: 31 files, 178 tests pass (9 new in `payment-qr-codes/__test__/`). Covers: bytes-based type check, rejection of non-images before any S3 call, cleanup when the save fails, partial update, branch scoping, replace and delete cleanup.
- `pnpm lint`: only the pre-existing warning in `staff-schedules.controller.ts`.
- Boot check on port 3100: `GET /api/payment-qr-codes` returns 401 without a session, `POST` returns 403 (CSRF). The process was stopped and the port freed.

**Not verified:** a real logged-in upload to S3 (RustFS). It needs the local S3 container and an admin login.

## Pending / next steps

1. Admin UI in `ibb_sms` (list, upload, rename, toggle, delete). Not started.
2. End-to-end upload against RustFS with an admin session.
3. Commit and release bump in `ibb_shop_release` once the UI exists.
4. `checkout_for_staff_with_qr.md` (10/10) says the admin upload was future work. This day's log supersedes that, and the older file is left as written.

## Related

- Read path and checkout: `docs/10102026/checkout_for_staff_with_qr.md`
- S3 module: `docs/05102026/s3_module.md`
- Product image upload (same pattern): `docs/07102026/product_image_upload.md`
