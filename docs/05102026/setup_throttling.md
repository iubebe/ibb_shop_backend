# Throttling (rate limiting)

Date: 05/10/2026

## Done
- `src/throttle/`: `@nestjs/throttler` with a custom Redis storage (`redis-throttler.storage.ts`, atomic Lua, shared by all app instances, keys `throttle:*`). The ready-made Redis storage package does not list Nest 12 support, so it is not used.
- `AppThrottlerGuard` is the first global guard (before CSRF/JWT), so floods are rejected before any token work. It also handles WebSocket messages.
- Limits, all **per client IP** (env in `.env.example`; defaults are generous because a whole shop shares one Wi-Fi IP):
  - `burst`: 50 requests/second across all routes
  - `default`: 600 requests/minute across all routes
  - both block the IP for 60 s once exceeded (`429`, `Retry-After`)
  - `strict`: 10/minute **per route**, only on `@StrictThrottle()` routes: `login`, `refresh`, `change-password`; blocked 60 s
  - new WebSocket connections: 30/minute per IP (checked in the handshake before origin/token checks)
- `@NoThrottle()` exempts a route (used on `/api/health`).
- `TRUST_PROXY=<hops>` makes `req.ip` (and the WebSocket IP) come from `X-Forwarded-For` when the API sits behind that many reverse proxies. Leave it 0 when exposed directly; a wrong value lets clients fake their IP or makes everyone share the proxy's.
- Other hardening in `src/main.ts` / the gateway: HTTP `headersTimeout` 15 s and `requestTimeout` 30 s (slow-request attacks), Socket.IO `maxHttpBufferSize` 64 KB.
- If Redis is down the limiter fails open (logs an error) so an outage does not take the API down.
- `THROTTLE_ENABLED=false` turns it off (local debugging only).

## Verified
Built app with low limits against local Redis: 20 unauthenticated calls gave 401 then 429 (so throttling runs before auth), `/health` never limited, login limited to 3 then 429 while other routes stayed fine, WebSocket handshakes limited after 3. 79 unit tests pass.

## Limits of this (read before relying on it)
- This stops abusive clients and brute force. It does **not** stop a real distributed DDoS: traffic still reaches Node and Redis, and bandwidth floods never get this far. Real protection belongs at the edge: a CDN/WAF (Cloudflare etc.) or reverse proxy (nginx/Caddy/Traefik) with connection and rate limits, plus firewall rules. Not set up yet (`ibb_shop_release` has no backend/proxy compose yet).
- Fixed windows: after a block lapses inside the same window the IP is blocked again until the window ends (e.g. login: ~60 s total).
- Per-IP only. Brute force spread over many IPs against one account is not covered; add a per-email counter on login if needed.
- Guests on one shop network share an IP; raise `THROTTLE_LIMIT` / `THROTTLE_BURST_LIMIT` if real traffic gets 429s.

## Pending / next
- Set `TRUST_PROXY` and edge limits when the production topology is decided; record it in `ibb_shop_release`.
- Consider per-account login lockout/backoff.
- Decide how guest (anonymous) endpoints should be limited once they exist (per table `qrToken` + IP).
