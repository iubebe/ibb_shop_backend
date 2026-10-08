# Unit Tests: Staff Order Creation

**Date:** 08/10/2026

## Test Coverage

Comprehensive unit tests created for the new staff-side order creation feature.

### OrdersService Tests (11 tests, ✅ all passing)

**File:** `src/modules/orders/__test__/orders.service.spec.ts`

Tests for `OrdersService.createOrder()` method:

1. **Creates order with valid table and items**
   - Validates table lookup via `findOne()`
   - Validates products via `find()`
   - Returns `StaffOrderView` with correct status

2. **404 on table not found**
   - Throws `NotFoundException` when table doesn't exist

3. **400 on unavailable products**
   - Throws `BadRequestException` when requested products are not available/active

4. **Deduplicates items with same product ID**
   - Same product requested twice → quantities merged
   - Multiple items become one line with summed quantity
   - Example: p1×2 + p1×3 → p1×5

5. **Calculates total from database prices**
   - Never trusts client-provided prices
   - Sums: (product_count × db_price) for all items
   - Example: p1×2@10k + p2×1@20k = 40,000

6. **Sets createdByUserId for tracking**
   - Order.createdByUserId = current user ID
   - Distinguishes staff-created from guest-created orders

7. **Returns complete StaffOrderView**
   - id, status, tableId, tableName, total, createdAt, confirmedAt
   - Items with: id, productId, name, quantity, servedQuantity, notes

8. **Existing setServed() tests unaffected**
   - All 3 original tests still pass

### OrdersController Tests (4 tests, ✅ all passing)

**File:** `src/modules/orders/__test__/orders.controller.spec.ts`

Tests for `POST /api/orders` endpoint:

1. **Calls service with user context**
   - Controller extracts branchId and userId from @CurrentUser()
   - Passes DTO to service.createOrder()

2. **Returns service result**
   - Response = StaffOrderView from service

3. **Passes through service errors**
   - Service exceptions (NotFoundException, BadRequestException) propagate to response

4. **Accessible by admin and staff**
   - Both roles can call the endpoint
   - Authorization enforced by @Roles() decorator

## Test Structure

**Mock Setup:** `buildCreateOrder()`
- Simulates TypeORM transaction and repository behavior
- Mocks table lookup, product search, order/item creation
- Returns fully formed mock Order with relations

**Assertion Approach:**
- Verify correct inputs to manager methods
- Verify output shape and values
- Verify error cases throw expected exceptions

## Running Tests

```bash
# Run all order tests
npm test src/modules/orders/__test__/

# Run service tests only
npm test src/modules/orders/__test__/orders.service.spec.ts

# Run controller tests only
npm test src/modules/orders/__test__/orders.controller.spec.ts

# Watch mode
npm test -- --watch src/modules/orders/__test__/
```

## Coverage

- **Service logic:** createOrder() method fully tested
- **Controller routing:** POST endpoint validated
- **Error cases:** NotFoundException, BadRequestException, missing table/products
- **Business logic:** deduplication, total calculation, user tracking
- **Integration:** service called with correct context from controller

## Notes

- Tests use Vitest mocks (vi.fn, mockResolvedValue, etc.)
- No database or external services needed; pure unit tests
- Existing backend test suite has pre-existing failures in unrelated modules (categories, products) due to mock setup issues; these do not affect our new tests

## Future Considerations

- Add integration tests with real DB (in separate suite)
- Test WebSocket event emission on order creation (when added)
- Test menu cache invalidation impact on guest orders
