# Dynamic payment QR (per-order amount)

Date: 24/10/2026

## What was done
- `payment_qr_codes.qrPayload` (nullable text): the VietQR text decoded from the uploaded image. Migration `1792900000000-PaymentQrPayload.ts` (verified up/down on a throwaway DB, dev DB not migrated yet).
- On create / replace image, `decodeVietQr` (`modules/payment-qr-codes/qr-decode.ts`, sharp + jsqr) reads the QR. It only keeps the text when the CRC is valid and tag 38 is a NAPAS 247 account; anything else (MoMo, ZaloPay, unreadable screenshot) stays `null`.
- `modules/payment-qr-codes/vietqr.ts`: parse, `readBank` (BIN, bank name, account no, name), `buildDynamicPayload` (initiation 12, tag 54 amount, tag 62/08 note, new CRC16).
- `GET /api/orders/:orderId/payment-qrs`: active QRs of the branch with `dynamicPayload` (order total + note `IBB <order id 8>`) and `bank`. Same roles as the other order endpoints.
- Tests: `payment-qr-codes/__test__/vietqr.spec.ts` (builds and decodes real PNGs via the `qrcode` dev dependency). Found and fixed `Đ` being dropped from the note.

## Decisions
- Decode on the backend at upload (single source of truth), not in the browser.
- The payload is built server-side from the stored order total, so the receipt can never print a stale amount.
- Static fallback: entries without a payload keep the uploaded image, admin card shows "QR tĩnh" / "QR động".
- Only `ibb_sms` for now; `ibb_shop_pos` checkout unchanged.

## Pending / next steps
- Existing QRs have `qrPayload = null` until re-uploaded (no backfill script); run the migration on the dev DB and re-upload each bank QR.
- Not tested with a real bank app scan or a real thermal printer.
- Bank BIN names map covers common banks only; unknown BINs print the BIN.
- pos checkout can reuse `GET /orders/:id/payment-qrs`.

See also `ibb_sms/docs/24102026/receipt_ui_and_dynamic_qr.md`.
