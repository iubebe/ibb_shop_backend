# Redis module

Date: 04/10/2026

## Done
- Added `ioredis` and a global `RedisModule` in `src/redis/` (imported in `src/app.module.ts`).
- `RedisService` wraps the client: `get`, `set` (optional TTL), `del`, `getJson`, `setJson`, `ping`. It quits the connection on shutdown.
- The raw ioredis client is injectable with `@Inject(REDIS_CLIENT)` for anything not wrapped.
- Config via `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` (see `.env.example`).

## Connecting
- Local dev: `localhost:6379` (published port from `ibb_shop_release/infra`).
- In Docker: join `ibb_network`, use `REDIS_HOST=redis`. See `ibb_shop_release/infra/docker-compose.yml`.

## Pending / next
- Not verified against a running Redis: ports 5432/6379 are held by other containers on the dev machine.
- Add Redis to the `/api/health` check once infra is up.
- `tsc` reports a pre-existing error in `test/app.e2e-spec.ts` (`supertest/types` not found).
