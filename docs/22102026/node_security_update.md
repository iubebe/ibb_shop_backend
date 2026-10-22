# Node.js October 2026 security update

Date: 22-10-2026

Source: https://nodejs.org/en/blog/vulnerability/october-2026-security-releases

## What was done
- Advisory fixes land in Node 24.22.1 (22.23.4 and 26.12.1 for the other lines). 24.x is affected by 8 CVEs; the highest severity is High (Brotli decoder RCE, `dns.resolve` NUL truncation, two TLS hostname bypasses).
- Bumped Volta pin from 24.21.0 to 24.22.1 in `package.json`.
- Pinned `Dockerfile` base images (build and runtime stages) from `node:24-alpine` to `node:24.22.1-alpine`, so the image no longer depends on whichever 24.x tag is cached.
- Same change in guest, pos and sms (see their docs of the same day). Only the backend runs Node at runtime; the frontends serve static files from nginx.

## Decisions
- Pinned an exact tag instead of the floating `node:24-alpine` so the fix is reproducible and visible in git. The cost is a manual bump on each Node release.
- CI uses `node-version: 24` (latest 24.x), which already resolves to the fixed version; left unchanged.

## Pending
- Rebuild and publish the backend image, then bump it in `ibb_shop_release` (see its doc of the same day).
- Local dev machine runs Node v24.14.0, which is affected: upgrade it (`volta install node@24.22.1`).
- Not run: install, build and tests were not re-run after the bump.
