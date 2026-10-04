# Data Model

## Entities

### Branch

- `id`, `name`, `address`

### User

- `id`, `branchId`, `name`, `email`, `passwordHash`, `role`
- `role`: `admin | staff` (extend with more granular roles later if needed;
  CASL can be layered on if permissions get more specific than this)

### Table

- `id`, `branchId`, `name` (e.g. "Table 4"), `qrToken` (unique, used in the
  guest-web URL: `guest.app.com/t/{qrToken}`)

### Category

- `id`, `branchId`, `name`

### Product

- `id`, `branchId`, `categoryId`, `name`, `price`, `imageUrl`, `isActive`

### InventoryItem

- `id`, `branchId`, `productId`, `quantity`
- Updated via `StockMovement` records, not written directly, to preserve an
  audit trail

### StockMovement

- `id`, `inventoryItemId`, `change` (+/-), `reason` (`sale | manual_adjustment | restock`),
  `createdAt`, `createdByUserId`

### PaymentQrCode

- `id`, `branchId`, `label` (e.g. "Bank transfer", "MoMo"), `imagePath`
  (local disk path/URL, served by the API ), `isActive`

### Order

- `id`, `branchId`, `tableId` (nullable — a manually-created order might not
  be tied to a table), `createdByUserId` (nullable — null if guest-submitted),
  `status`, `paymentMethod`, `paymentStatus`, `total`, `createdAt`, `confirmedAt`, `paidAt`

### OrderItem

- `id`, `orderId`, `productId`, `quantity`, `unitPrice`, `notes`

## Enums

```
OrderStatus:
  pending_confirmation   # guest-submitted, awaiting staff review
  confirmed              # staff-approved (or staff-created directly)
  paid                   # checked out on POS
  cancelled

PaymentMethod:
  cash
  qr_manual

PaymentStatus:
  pending
  paid

UserRole:
  admin
  staff
  cashier
```

## Order state machine

```
[guest submits cart]  ──────────────► pending_confirmation
                                              │
                                    staff confirms with guest
                                              ▼
[staff creates order directly] ───────►  confirmed then serving
                                              │
                                  cashier selects on POS, checks out
                                              ▼
                                            customer paid
```

Notes:

- Guest-submitted orders always pass through `pending_confirmation`.
- Staff-created orders (staff placing the order for a guest who can't scan
  the QR) go straight to `confirmed` — no self-confirmation step.
- `cancelled` can be reached from `pending_confirmation` or `confirmed` if
  staff rejects/voids an order — add this transition when building the
  admin-web queue UI.
- Whether a table can receive additional items _after_ an order is
  `confirmed` (a running tab vs. one order per round) is still an open
  decision — if you want a running tab, add items to the existing `confirmed`
  order instead of creating a new one; if not, each round is a separate order
  and POS shows multiple open orders per table.

## Indexes worth adding early

- `Order(branchId, status)` — POS order list and admin pending-queue both
  filter on this
- `Table(qrToken)` unique — guest-web lookup on every page load
- `InventoryItem(productId)` — stock checks on every order confirmation
