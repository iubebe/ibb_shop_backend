# WiFi QR module and table QR sheet (22-10-2026)

## What was done
- New admin-only module `src/modules/wifi/` (`/api/wifi`): list, create, rotate credentials (`PUT :id/credentials`), activate/deactivate (`PATCH :id`), stream QR image (`GET :id/image`), delete.
- Entity `wifi_networks` (`src/database/entities/wifi-network.entity.ts`), migration `1792630000000-WifiNetworks.ts` (hand-written, **not yet run against a DB**).
- `TablesService.qrPdf` now prints the table name above each table QR and, if the branch has an active WiFi network, its QR below with an `WiFi: <ssid>` caption.

## Security decisions
- The password is accepted once in the request body and only encoded into the QR PNG. It is never written to the DB, Redis or logs (pino logs no bodies). The API never returns it or the S3 key.
- A WiFi QR *is* the password in another form, so the image sits in a private `wifi-qr` bucket (created lazily via `ensureBucket`), is streamed only to admins with `Cache-Control: no-store`, and is never cached in Redis (unlike payment QR images).
- Create and rotate use `@StrictThrottle`. Credentials are validated like a phone would (WPA 8-63 / 64 hex, WEP 5/13 chars, SSID <= 32 bytes) so a printed QR can't silently fail to connect.
- `WIFI:` payload fields are escaped (`\ ; , : "`).
- Printed sheets contain the password in scannable form; rotate the password when a sheet leaks.
- One active network per branch (partial unique index); creating a new one makes it active.

## Decisions
- Changing the password means re-entering the full credentials (the QR can't be rebuilt without it).
- Built-in PDF fonts only cover Latin-1, so non-Latin-1 letters in table names are reduced to base letters (`Bàn Ế` prints as `Bàn E`). Embedding a Unicode TTF would fix it.

## Pending
- Run the migration on a throwaway DB (docker was not running), then dev DB.
- ibb_sms admin UI for WiFi (add/rotate/activate/delete, preview) and a toggle if the sheet should skip WiFi.
- Default 3x4 grid makes each QR ~2.5 cm when WiFi is included; use `rows=3` or `columns=2` for easier scanning.
- Infra init job could pre-create the `wifi-qr` bucket (backend creates it on first use).
