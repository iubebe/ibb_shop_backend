# Shop Management App — Overview & Architecture

## Purpose

A shop management system covering: product/inventory administration, a guest-facing
table-ordering menu, staff order confirmation, and a POS checkout screen with
manual (non-gateway) QR payment confirmation.

## High-level flow

1. Guest scans table QR → `ibb_shop_guest` → browses menu → submits cart
   (order status `pending_confirmation`)
2. `ibb_sms` receives a live notification (GraphQL subscription over Redis
   pub/sub) → staff reviews with guest → confirms (order status `confirmed`)
   — **or** staff creates the order directly in `ibb_sms` on the guest's
   behalf, skipping `pending_confirmation` entirely
3. Staff opens `ibb_shop_pos` → order list → selects the order → checkout detail
   screen → picks payment method (cash / QR) → for QR, displays the branch's
   uploaded QR image ( `PaymentQrCode`) → staff manually
   marks the order `paid` once payment is confirmed in person (no payment
   gateway integration)

## Explicitly out of scope for this phase

- Real payment gateway integration (QR is a static uploaded image, payment
  confirmation is manual)
- Warehouse/inventory receiving app (removed from initial scope)
- Offline-first support for POS or ibb_shop_guest
- Multi-terminal POS session management (single shared POS screen only)

