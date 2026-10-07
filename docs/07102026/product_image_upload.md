# Product image upload (RustFS)

Date: 07/10/2026

## Done

- `POST /api/products/:id/image` (admin): multipart field `image`, JPEG/PNG/WebP, max 5 MB. Stores it in RustFS at `products/<branchId>/<uuid>.<ext>`, sets `imageUrl` to the public URL and returns the product. The replaced image is deleted.
- `DELETE /api/products/:id/image` (admin): clears `imageUrl` and deletes the object; returns the product.
- `PATCH` with a changed/null `imageUrl` and `DELETE /products/:id` also delete the old object when it is ours (URL under `S3_PUBLIC_URL`). Foreign URLs are never touched.
- `S3Service.keyFromPublicUrl(url)` (inverse of `getPublicUrl`).
- Type is checked from the file bytes, not the client header. Objects are uploaded with `Cache-Control: public, max-age=31536000, immutable` (keys are unique per upload).

## Decisions

- Upload goes through the backend (not presigned PUT) so the type/size checks and branch scoping stay in one place. Same multer memory-storage pattern as attendance.
- Public URL = `S3_PUBLIC_URL`, i.e. `https://media.<DOMAIN>` in production (see `ibb_shop_release/docs/07102026/media_host.md`). The URL is stored in `products.image_url`, so changing the media domain later means rewriting those rows.
- No resizing/compression (no image library added). Pending if 5 MB originals prove too heavy on phones.
- Cleanup of old objects is best effort; a failed delete leaves an orphan but never fails the request.

## Verified

- `pnpm build`, `pnpm lint`, `pnpm test` pass (new unit tests in `products.service.spec.ts`).

## Pending

- Not run against a real RustFS (upload, public read through nginx).
- No UI yet in `ibb_sms`; guest already reads `imageUrl`.
- nginx `client_max_body_size` is 20m on the api host, so the 5 MB limit is enforced by the backend.
