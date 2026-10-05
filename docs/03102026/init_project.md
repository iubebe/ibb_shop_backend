# ibb_shop_backend: Project Init Notes

Date: 2026-10-02 (scaffold), notes filed 2026-10-03.

## Overview

`ibb_shop_backend` is the NestJS backend for the Iubebe Shop system. It serves REST and WebSocket to the frontends `ibb_shop_guest`, `ibb_shop_pos` and `ibb_sms`. Deployment is handled by `ibb_shop_release`.

## Scaffold

- Generated with Nest CLI 12 (`nest new`, strict mode, npm), then copied into the existing repo. The repo's `.git` and `README.md` were kept.
- Package name: `ibb_shop_backend`.
- ESM (`"type": "module"`), so imports use `.js` suffixes.
- TypeScript strict mode, built with `nest build` (tsc), run with `node dist/main.js`.
- Tests: Vitest (`npm test`, `npm run test:e2e`). Lint: oxlint.
- Added dependencies: `@nestjs/config`, `@nestjs/websockets`, `@nestjs/platform-socket.io`.

## What exists

| Item | Detail |
|---|---|
| Global prefix | `/api`, with CORS enabled |
| `GET /api` | Hello World (generated sample) |
| `GET /api/health` | Returns `{ "status": "ok" }` |
| `EventsGateway` | Socket.IO gateway (`src/events/events.gateway.ts`); `ping` message returns `pong` (not yet tested) |
| Config | `ConfigModule.forRoot({ isGlobal: true })`; `.env.example` has `PORT=3000` |
| `.gitignore` | `node_modules`, `dist`, `coverage`, `.env`, `*.tsbuildinfo`, `.DS_Store` |

## Verification done

- `npm run build` succeeds.
- `npm test` passes (1 test).
- Smoke run of the built server: `/api/health` returned `{"status":"ok"}`.

## Vitest warning fix (unfinished)

Vitest warned: `The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution natively...`

- Done: `vitest.config.ts` and `vitest.config.e2e.ts` now use `resolve: { tsconfigPaths: true }` instead of the plugin.
- Remaining: `npm uninstall vite-tsconfig-paths`, then re-run `npm test` to confirm the warning is gone.

## Notes

- Vite is not used by the backend at runtime or for the build. It is only a transitive dependency of Vitest.
- npm warns that Node v24.14.0 is older than the minimum npm supports (24.15). It does not affect the build.
- Nothing is committed yet.

## Open decisions / next steps

1. Choose a database and ORM (for example Postgres with TypeORM or Prisma).
2. Add auth.
3. Add the first domain modules: products, orders, HR face-ID check-in.
4. Define the realtime events for the order flow (guest -> backend -> sms -> pos).
5. Commit the scaffold.
