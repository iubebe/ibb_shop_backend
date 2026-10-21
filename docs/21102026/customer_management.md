# Customer management

Date: 21-10-2026

## What was done

- New `customers` table and `Customer` entity (`src/database/entities/customer.entity.ts`): per branch, name/phone/address all optional, unique `(branchId, phone)` where phone is set.
- `orders` gets `customerId` (FK, `ON DELETE SET NULL`) plus snapshot columns `customerName/Phone/Address`. Migration: `src/database/migrations/1792546244494-Customers.ts` (hand-trimmed from the generator output, round-tripped up/down on a throwaway DB).
- Create order (`POST /api/orders`, admin + staff): optional `customerName`, `customerPhone`, `customerAddress`. The customer is created or reused in the same transaction (`resolveCustomer` in `src/modules/customers/customer-info.ts`).
- Edit order customer (`PATCH /api/orders/:orderId/customer`, admin + staff): allowed while the order is not paid. Omitted field = unchanged, `null`/blank = cleared.
- Customer management (`/api/customers`, admin only): list with `?search=` (name/phone/address), get, patch, delete. Each row has `orderCount`, `totalSpent` (paid orders) and `lastOrderAt`.
- All staff order views now return the four customer fields.

## Decisions

- **Phone is the identity.** Same phone in the same branch reuses the customer and fills in a name/address that is new. Without a phone, every order with a name/address creates a new customer (we cannot tell two "An"s apart).
- **Orders keep a snapshot** of what was typed, so editing or deleting a customer never rewrites past orders. Deleting a customer only unlinks (`customerId` becomes null).
- **Editing an order's customer** re-resolves the link: changing the phone moves the order to another (or new) customer; the old customer is not deleted.
- **Cancelled orders are also locked** (not only paid ones). The request only said "not paid yet"; editing a cancelled order is pointless, so it returns 409.
- Phone is normalised (spaces, dots, dashes, parentheses stripped) and must be `+` optional, 8-15 digits.
- Customers are not created by hand; only orders create them.

## Pending / next steps

- Run the migration on the dev DB (`pnpm migration:run`); not applied there yet.
- Guest orders have no customer info (guest app unchanged).
- Possible follow-ups: show customer on the POS receipt, link to a customer's order history, merge duplicate name-only customers.
