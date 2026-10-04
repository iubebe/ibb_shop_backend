# Database setup (Postgres + TypeORM)

Date: 05/10/2026

## Done
- Implemented the schema from `docs/init/01-data-model.md` with TypeORM 1.x (`typeorm`, `@nestjs/typeorm`, `pg`). ORM choice: TypeORM, picked by the user.
- `src/database/`: `DatabaseModule` (imported in `src/app.module.ts`), `database.config.ts` (shared by Nest and the CLI), `data-source.ts` (CLI entry), `entities/`, `enums.ts`, `transformers.ts`, `migrations/`.
- 10 entities: Branch, User, DiningTable (table `tables`), Category, Product, InventoryItem, StockMovement, PaymentQrCode, Order, OrderItem. UUID primary keys; money is `numeric(12,2)` mapped to a JS number.
- Indexes from the doc: `Order(branchId, status)`, unique `tables.qrToken`, `InventoryItem.productId` (made unique: one row per product). Also unique `users.email`.
- `synchronize` is always off; schema changes go through migrations. Initial migration `InitSchema` was applied to the local `ibb-postgres`.
- Env (see `.env.example`): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_LOGGING`, `DB_MIGRATIONS_RUN`. In Docker use `DB_HOST=postgres` on `ibb_network`.

## Commands
- `pnpm migration:generate src/database/migrations/<Name>`, `pnpm migration:run`, `pnpm migration:revert`. They build first because the CLI runs against `dist/` (ESM + decorators).

## Decisions
- `UserRole` is `admin | staff | cashier`: the doc's entity text said two roles, its enum said three; the user chose three.
- `User.passwordHash` is `select: false`; load it explicitly for login.
- `OrderStatus` has the four enum values only. The state machine's "serving" step is not modelled.
- `Order.paymentMethod` is nullable (decided at POS checkout).

## Pending / next
- Open decision from the doc: running tab vs. one order per round. Schema supports both.
- Nothing writes data yet: no seed, no feature modules, no auth. Stock changes must go through `StockMovement` once the inventory module exists.
- Add a database check to `/api/health`.
- `DB_MIGRATIONS_RUN=true` for container startup is untested; decide how the release stack runs migrations, then document it in `ibb_shop_release`.
