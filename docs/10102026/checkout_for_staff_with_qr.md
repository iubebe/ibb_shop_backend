# Checkout for Staff with Payment QR Codes

**Date:** 10/10/2026

## Summary

Backend implementation for staff checkout and payment QR code API.

## Changes

### Orders Service
- Added `getPaymentQrCodes(branchId)` method to fetch active payment QR codes

### Orders Controller
- Updated `/orders/:orderId/pay` endpoint: added `staff` role to `@Roles` decorator
- New endpoint `GET /orders/payment-qr-codes` - returns active payment QR codes for user's branch

## API Details

**GET /orders/payment-qr-codes**
- Authentication: required
- Roles: admin, staff, cashier
- Response: `PaymentQrCode[]`

```json
{
  "id": "uuid",
  "label": "Bank transfer",
  "imagePath": "/path/to/qr.png",
  "isActive": true
}
```

**POST /orders/:orderId/pay**
- Updated to include `staff` role
- Accepts: `{ paymentMethod: 'cash' | 'qr_manual' }`
- Both methods immediately mark order as `PAID`

## Files Modified
- `src/modules/orders/orders.service.ts`
- `src/modules/orders/orders.controller.ts`

## Related Frontend Changes
- `ibb_sms`: Updated checkout sheet with QR display
- `ibb_shop_pos`: Updated checkout sheet with QR display

See main doc in `ibb_sms/docs/10102026/checkout_for_staff_with_payment_qr.md`
