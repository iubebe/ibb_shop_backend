# Payment QR Images: Private Access & Media Bucket Isolation

**Date:** 11/10/2026

## Overview

Implemented private authenticated access for payment QR code images while isolating public media files under a single `media/` prefix in the S3 bucket.

**Changes:**
- Payment QR images are now served privately via authenticated API endpoint
- Product images remain public under `media/products/`
- Bucket policy enforces public read access only for `media/*` prefix
- Backend applies bucket policy on startup (idempotent)

## API Changes

### New Endpoint: `GET /payment-qr-codes/:id/image`

**Authentication:** Required (ADMIN, STAFF, CASHIER roles)
**Response:** 302 redirect to presigned S3 URL (1 hour expiration)

```bash
# Admin managing QR codes
curl -H "Cookie: auth=..." \
  https://api.iubebe.vn/api/payment-qr-codes/123/image
# → redirects to presigned S3 URL
```

**Returns:**
- `302 Found` with `Location` header (presigned S3 URL)
- Browser/client follows redirect to download image from S3

### Updated Fields

**`POST /payment-qr-codes` → Response:**
```json
{
  "id": "uuid",
  "label": "Bank Transfer",
  "imagePath": "payment-qr/branch-id/uuid.jpg",  // S3 key, not public URL
  "isActive": true,
  "createdAt": "2026-10-11T...",
  "updatedAt": "2026-10-11T..."
}
```

The `imagePath` field now contains the S3 key instead of a public URL. Clients must request `GET /payment-qr-codes/{id}/image` to fetch the image.

## Bucket Architecture

**Three S3 Buckets:**

| Bucket | Scope | Access | Usage |
|--------|-------|--------|-------|
| `ibb-media` | Public | Anonymous GetObject on `products/*` | Product images (via nginx at media.<domain>) |
| `payment-qr` | Private | Authenticated API | Payment QR codes (via `/api/payment-qr-codes/{id}/image`) |
| `attendances` | Private | Authenticated API | Attendance photos (via authenticated endpoint) |

**Structure:**
```
ibb-media/                          (public policy on products/ prefix)
└─ products/{branchId}/{uuid}.{ext}

payment-qr/                         (private)
└─ {branchId}/{uuid}.{ext}

attendances/                        (private)
└─ {branchId}/{userId}/{recordId}-{type}.jpg
```

## Backend Implementation

### S3Service Changes

**Updated method: `ensurePublicPolicy()`**
- Runs on module init via `OnModuleInit` hook
- Sets bucket policy to allow anonymous `GetObject` on `products/*` prefix only
- Uses default bucket (ibb-media) for policy
- Idempotent (safe to call repeatedly)

**Removed config: `publicPrefix`**
- No longer needed; prefix is hardcoded as `products/`

**Existing method: `getPresignedGetUrl(key, expiresInSeconds)`**
- Generates time-limited signed URLs for private image access
- Used by payment QR and attendance endpoints

### Upload Configuration

| Type | Bucket | Path | Access |
|------|--------|------|--------|
| Product images | `ibb-media` | `products/{branchId}/{uuid}.{ext}` | Public (via nginx) |
| Payment QR | `payment-qr` | `{branchId}/{uuid}.{ext}` | Private (API endpoint) |
| Attendance photos | `attendances` | `{branchId}/{userId}/{recordId}-{type}.jpg` | Private (API endpoint) |

### Cache Control

| Type | Setting | Reason |
|------|---------|--------|
| Product images | `public, max-age=31536000, immutable` | Cached by browsers & CDN |
| Payment QR | `private, max-age=31536000, immutable` | Browsers cache only, CDN doesn't |
| Attendance | `private, max-age=...` | Sensitive data |

## Database Changes

### Migration: `1791655200000-PaymentQrPrivateImages.ts`

Converts `payment_qr_codes.imagePath` from public S3 URLs to S3 keys.

**Before:**
```
imagePath: "http://localhost:9000/ibb-media/payment-qr/..."
```

**After:**
```
imagePath: "payment-qr/branch-id/uuid.jpg"
```

### Entity Update

`PaymentQrCode.imagePath` comment updated:
- Old: "Public S3 URL of the uploaded image"
- New: "S3 key of the uploaded image (served via authenticated endpoint)"

## Deployment

### Infrastructure (`ibb_shop_release/infra`)

**`rustfs-init` Job Updates:**
- Bucket policy now allows public read on `media/*` prefix (was `products/*`)
- Runs once at infra startup to initialize bucket and policy

### Application Stack (`ibb_shop_release/deployment`)

**No changes required to docker-compose.yml**
- Backend automatically applies policy on startup
- Existing `S3_PUBLIC_URL` config still valid (points to nginx media domain)
- Payment QR images bypass nginx, go through authenticated API

## Access Control

| Role | List QR Codes | Create/Edit QR | Download Image |
|------|---|---|---|
| ADMIN | ✓ | ✓ | ✓ |
| STAFF | ✗ | ✗ | ✓ |
| CASHIER | ✗ | ✗ | ✓ |

## Migration Notes

### For Existing Deployments

1. **Backup existing QR codes** (optional, data is copied in migration)
2. **Run database migration** (auto-runs on backend startup if `DB_MIGRATIONS_RUN=true`)
3. **Redeploy frontend** (ibb_sms) to use new authenticated endpoint
4. **Infra policy update** (rustfs-init only runs once; manually update if needed)

### Zero-Downtime Migration

- Old public QR URLs will become invalid after migration
- Staff/cashier can't use checkout until frontend is updated
- Recommend deploying backend first, then frontend within same release window

## Testing

### Manual Test: Admin Manages QR Codes

```bash
# Create QR code
curl -X POST https://api.iubebe.vn/api/payment-qr-codes \
  -H "Cookie: auth=..." \
  -F "label=Bank Transfer" \
  -F "image=@qr.jpg"
# → Returns imagePath as S3 key, not URL

# Get image (as admin)
curl -I https://api.iubebe.vn/api/payment-qr-codes/uuid/image \
  -H "Cookie: auth=..."
# → 302 with presigned S3 URL
# → Follow redirect, image downloads
```

### Manual Test: Staff Checkout

1. Open checkout sheet
2. Select "Chuyển khoản" payment method
3. Verify QR code images display (loaded via authenticated endpoint)
4. Verify staff cannot access unauthenticated S3 URLs

### Manual Test: Public Isolation

```bash
# Product images are still public (via nginx)
curl https://media.iubebe.vn/products/branch-id/uuid.jpg
# → 200 OK (publicly accessible)

# Payment QR cannot be accessed directly
curl https://s3.iubebe.vn/payment-qr/branch-id/uuid.jpg
# → 403 Forbidden (policy denies anonymous access)

# Must go through authenticated endpoint
curl -H "Cookie: auth=..." https://api.iubebe.vn/api/payment-qr-codes/uuid/image
# → 302 with presigned URL
```

## Next Steps

- [ ] Deploy backend to staging
- [ ] Run database migration (auto)
- [ ] Deploy ibb_sms to staging
- [ ] Test staff checkout with QR payment
- [ ] Monitor S3 bucket policy compliance
- [ ] Update infra rustfs-init policy in production (if not auto-applied)

## Related Issues

- [[Payment QR Admin API]] — Admin upload/manage QR images (completed)
- [[Order payment by table UI]] — Uses QR images in checkout

## References

- **Files Changed:**
  - `src/s3/s3.service.ts` — Bucket policy, public prefix config
  - `src/s3/s3.types.ts` — S3Options.publicPrefix
  - `src/s3/s3.config.ts` — Load publicPrefix from env
  - `src/modules/payment-qr-codes/` — Private endpoint, storage
  - `src/database/entities/payment-qr-code.entity.ts` — Entity comment
  - `src/database/migrations/1791655200000-PaymentQrPrivateImages.ts` — Migration

- **Infrastructure:**
  - `ibb_shop_release/infra/docker-compose.yml` — rustfs-init policy update
