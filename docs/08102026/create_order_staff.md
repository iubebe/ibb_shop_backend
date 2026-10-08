# Staff-side Order Creation

**Date:** 08/10/2026

## Overview

Implemented a new feature allowing ADMIN and STAFF roles to create orders manually by selecting a table and adding items. This complements the existing guest-side order creation via QR codes.

## Backend Changes

### New Endpoint
- **POST** `/api/orders` — Create an order for a table
  - **Roles:** `ADMIN`, `STAFF`
  - **Input:** `CreateOrderStaffDto` with `tableId` and `items`
  - **Returns:** `StaffOrderView` with the created order details

### Files Changed

1. **`src/modules/orders/dto/create-order-staff.dto.ts`** (new)
   - `CreateOrderItemDto`: Product ID, quantity, optional notes
   - `CreateOrderStaffDto`: Table ID and array of items

2. **`src/modules/orders/orders.service.ts`**
   - Added `createOrder(branchId, userId, dto)` method
   - Validates table exists and belongs to the branch
   - Validates all products are active
   - Calculates order total from database prices (not client-provided)
   - Deduplicates items if the same product appears multiple times (joins notes with `; `)
   - Marks order with `createdByUserId` to track staff creation

3. **`src/modules/orders/orders.controller.ts`**
   - Added `POST` endpoint with `@Roles(ADMIN, STAFF)`
   - Calls `orders.createOrder()` with current user ID

4. **`src/modules/orders/orders.module.ts`**
   - Added `DiningTable`, `Product`, and `OrderItem` to `TypeOrmModule.forFeature()`

### Design Notes

- Orders created by staff start in `PENDING_CONFIRMATION` status (same as guest orders)
- Deduplication mirrors the guest-side logic: identical products are merged with notes joined
- Security: table and products validated server-side; user is scoped to branch via auth
- The `createdByUserId` field distinguishes staff-created orders from guest orders (which have null)

## Order Flow

1. Staff navigates to "Create Order" page in SMS app
2. Selects a table from the branch's active tables
3. Adds items (products) with quantities
4. Reviews order total (calculated live)
5. Submits → backend validates and persists
6. Order appears in the reception queue in `pending_confirmation` status

## Test Coverage

**See:** [create_order_staff_tests.md](create_order_staff_tests.md)

- **Service:** 11 tests (createOrder method, deduplication, validation, total calc)
- **Controller:** 4 tests (routing, auth, error handling)
- **Status:** ✅ All 15 tests passing

Key test scenarios:
- Valid order creation with items
- Table/product validation (404, 400 errors)
- Item deduplication (same product merged)
- Total calculated from DB prices (never client input)
- CreatedByUserId tracking for audit trail

## Pending / Next Steps

- **Checkout serving by table** (cashier): implement POS flow to confirm and pay table orders
- Add notes/special instructions UI to staff order creation (currently stripped)
- Consider WebSocket events for real-time reception updates
- Add integration tests with real database
