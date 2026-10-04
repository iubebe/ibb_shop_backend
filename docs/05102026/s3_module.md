# S3 module (RustFS integration)

Date: 05/10/2026

Infra side: `ibb_shop_release/docs/05102026/infra_rustfs.md`.

## What was done

- New global `S3Module` in `src/s3/`, mirroring `RedisModule`. Registered in `src/app.module.ts`.
- Uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` with `forcePathStyle: true` (RustFS needs path-style).
- Env (added to `.env.example`): `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL`. Defaults match the infra `.env.example`. `S3_PUBLIC_URL` defaults to `<endpoint>/<bucket>`.
- Exported for reuse: `S3Service`, plus the raw client via `@Inject(S3_CLIENT)` and the resolved config via `@Inject(S3_OPTIONS)`.

## S3Service API

`upload`, `download` (stream), `exists`, `delete`, `deleteMany` (chunked by 1000), `list` (paginated), `ensureBucket`, `getPublicUrl`, `getPresignedGetUrl`, `getPresignedPutUrl`. All take an optional bucket override and default to `S3_BUCKET`. Signatures are in `src/s3/s3.service.ts`.

## Decisions

- Methods return keys and URLs, not DB changes. Feature modules (products, payment QR) decide key layout, e.g. `products/<id>.<ext>`, `qr/<id>.<ext>`.
- `ensureBucket` is not called on startup, since infra's `rustfs-init` already creates the bucket. Call it explicitly if needed.

## Verified

- Lint, build, and unit tests (`src/s3/__test__`, SDK mocked) pass.
- A Nest context with the built `S3Module` resolves DI and produces public and presigned URLs.

## Pending / next steps

- Not tested against a running RustFS (it was not started): real upload/download, `HeadObject` 404 handling, and presigned URLs are unconfirmed.
- No upload endpoints yet (multipart handling, size and mime limits, auth). Next: product image and payment QR upload, saving the key or URL on `product` / `payment-qr-code`.
- Decide public access for the bucket (see infra doc); it determines `getPublicUrl` vs presigned URLs.
