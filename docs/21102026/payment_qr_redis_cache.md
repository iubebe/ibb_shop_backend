# Payment QR Redis cache — 21/10/2026

## Done
- `src/modules/payment-qr-codes/payment-qr-codes.service.ts`: `list()` caches the branch's rows in Redis (`payment-qr:list:<branchId>`, 5 min). `getImage()` resolves the code from that cached list, then caches the image bytes (`payment-qr:img:<s3Key>`, 1 h) so S3 is hit once per image.
- Writes (`create`, `update`, `replaceImage`, `remove`) drop the list key; `replaceImage`/`remove` also drop the old image key.
- Redis errors are logged as warnings and fall back to the DB / S3, so a Redis outage never breaks checkout.
- `src/redis/redis.service.ts`: added `getBuffer` / `setBuffer`.
- Tests: `__test__/payment-qr-codes.service.spec.ts` (hit, invalidation, image cache, Redis-down fallback, branch isolation).

## Decisions
- Image key uses the S3 key (new UUID per upload), so a replaced image can never be served stale even if invalidation fails.
- Writes still read the DB (`find`) so edits never act on cached data.

## Pending
- Not run against a live Redis; verified with mocks only. Cached list holds dates as strings (JSON), identical in the HTTP response.
- The 5 MB image limit bounds Redis value size; revisit TTLs if memory matters.
