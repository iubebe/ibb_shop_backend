# Auth: access token, refresh token, CSRF

Date: 05/10/2026

## Done
- `src/auth/`: cookie-based auth for REST and WebSocket (`AuthModule`, imported in `src/app.module.ts`). Deps added: `@nestjs/jwt`, `argon2`, `cookie-parser`, `cookie`. `pnpm-workspace.yaml` sets `allowBuilds: argon2: false` (prebuilt binary works).
- **access_token**: HS256 JWT, 15 min. Claims: `sub`, `role` (admin | staff | cashier), `branchId`, `sid` (refresh-session id). Stored in an httpOnly cookie.
- **refresh_token**: opaque `<sessionId>.<secret>`, 7 days, httpOnly cookie limited to `/api/auth`. Handled only in Redis (`src/auth/refresh-token.store.ts`): Redis keeps the SHA-256 of the secret; each refresh rotates the secret atomically (Lua). Presenting an old secret revokes the session (reuse detection). Keys: `auth:session:<sid>`, `auth:user-sessions:<uid>`.
- **csrf_token**: signed double-submit token (`GET /api/auth/csrf` sets a readable cookie; clients echo it in the `X-CSRF-Token` header). Required on every POST/PUT/PATCH/DELETE, including login, refresh and logout, so it also covers the public guest endpoints.
- **Guards (global, `APP_GUARD`)**, in order: `CsrfGuard` (HTTP only) -> `AuthGuard` (HTTP + WS) -> `RolesGuard`. Opt out with `@Public()`, restrict with `@Roles(...)`, read the user with `@CurrentUser()`.
- **WebSocket**: `WsAuthMiddleware` (registered in `EventsGateway.afterInit`) checks the Origin against `CORS_ORIGINS` and the access cookie at handshake. `AuthGuard` re-verifies the token on every message, so an expired token stops working.
- Routes: `GET /api/auth/csrf`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`. `/api`, `/api/health`, `/api/version` are `@Public()`.
- CORS now uses `CORS_ORIGINS` with `credentials: true` (was `*`). Env vars are listed in `.env.example`; `JWT_ACCESS_SECRET` and `CSRF_SECRET` (>= 32 chars) are required, startup fails without them.

## Verified
Built app against local Postgres + Redis: public routes open, `/auth/me` 401 without cookie, unsafe request without CSRF 403, bad password 401, login sets the two httpOnly cookies, refresh rotates, replaying the old refresh token returns 401 and revokes the session. Socket.IO: no cookie, tampered token and bad Origin are rejected; a valid cookie connects and `ping` works. 59 unit tests pass.

## Decisions
- Permissions: a `@Roles()` guard now; CASL later, once rules need to be finer than the three roles (data-model doc). The role claim in the token is what CASL abilities would be built from.
- Role changes take effect at the next refresh (access token lifetime), not instantly.
- Login/refresh errors are generic; unknown emails still burn an argon2 check.

## Pending / next
- No way to create users yet (no seed, no admin endpoint). A test user was inserted by hand into the local DB (`cashier@test.local`); remove it or replace with a seed.
- No rate limiting on login (brute force); consider a Redis counter.
- Refresh sessions have no absolute lifetime (sliding 7 days). Add a hard cap if needed.
- Two tabs refreshing with the same token at once: the second one is treated as reuse and kills the session. Frontends must serialize refresh calls (or add a short grace window later).
- Access tokens are not revocable before expiry (logout only kills the refresh session).
- WebSocket clients must reconnect after a refresh when the access cookie expires.
- Guest endpoints (menu, order submit) are not built yet; mark them `@Public()`.
- Input validation is manual in `auth.controller.ts`; pick a validation library (class-validator or zod) before adding more endpoints.
- Production: `COOKIE_SECURE=true`, set `COOKIE_DOMAIN` if frontends are on sibling subdomains, `COOKIE_SAMESITE=none` only if they are cross-site.
