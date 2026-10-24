# Backdated orders and dated Excel import

**Date:** 24/10/2026

## What was done

1. **Admin adds many orders for a past day.** `POST /api/orders/backdated` (admin only).
   Body: `date` (`YYYY-MM-DD`), `paymentMethod` (`cash` | `qr_manual`), `orders[]` of `{ tableId, time?, items[] }`.
2. **Excel import takes any day.** The sheet from `docs/10102026/order_excel_import.md` gets two optional columns, `Ngày` and `Thanh toán`.

Code: `src/modules/orders/backdated/` (service, controller, DTO, constants, `__test__/`); changes in `src/modules/orders/order-import/`; both registered in `orders.module.ts`.

## Decisions

- **A backdated order is a finished sale.** Status `paid`, `paymentStatus` paid, every item `servedQuantity = quantity`, and `createdAt`, `confirmedAt`, `paidAt` all set to the order time. Dashboard and finance read `paidAt`, order history reads `createdAt`, so the order lands on the right day in both.
- **Admin only**, for both entry points. In the import, a row with `Ngày` from a non-admin is a row error. Rows without `Ngày` behave exactly as before (live confirmed order, admin and staff).
- **No future times.** Time is shop time, fixed `+07:00` (Vietnam has no DST). Date only means 12:00. Impossible dates (31/02) are rejected, not rolled over.
- **Prices are today's menu prices.** There is no price history; only active products are accepted, so discontinued items cannot be entered.
- **Import stays all or nothing.** Live and dated orders in one file are written in one transaction (`BackdatedOrdersService.createMany` joins the import's transaction).
- **Sheet format:** `Ngày` accepts `dd/mm/yyyy`, `dd/mm/yyyy HH:mm`, `yyyy-mm-dd [HH:mm]` or a real Excel date cell. `Thanh toán` is `Tiền mặt` (default) or `Chuyển khoản`, only with a date. All lines of one order must share date and payment. The template column `Ngày` is text-formatted.
- **Limits** unchanged: 200 orders, 50 lines per order.

## Verification

- `pnpm build`, `pnpm lint` (only the two existing warnings), `pnpm test`: 42 files, 267 tests pass (new: backdated service, parser date/payment, import dated path).
- **Not verified:** a run against a real database. Docker was not running. Still unchecked: that TypeORM persists the explicit `createdAt`/`updatedAt` on insert, and a real upload through the API.

## Pending

- Run the service on the throwaway DB (`ibb_migtest`) and check `createdAt`, dashboard and finance for a backdated order.
- Release bump in `ibb_shop_release` after the checks.
- Staff still have no UI for the Excel import (live orders); the new UI is admin only.

Frontend: `ibb_sms/docs/24102026/backdated_orders_ui.md`.
