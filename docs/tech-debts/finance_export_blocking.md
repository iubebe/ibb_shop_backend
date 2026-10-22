# Tech debt: finance export runs on the main thread

Date: 22/10/2026

Related: `docs/22102026/finance_excel_export.md`

## Problem
`GET /api/finance/export` is a plain request/response call, not a background job. The database queries are async, but building the workbook (exceljs + jszip chart injection) is synchronous CPU work on the Node main thread. While it runs, the process cannot serve other requests.

- A one-month export is small (~30 daily rows plus a few tables): likely under 50 ms.
- A 366-day export with a long expense list may take a few hundred ms of stall.
- No queue, no progress, no limit on concurrent exports. Admin only, so concurrency is unlikely to matter today.

Not measured yet; the figures above are estimates.

## Options
1. **Cap the export range (~92 days).** One-line check in the export path. Cheapest.
2. **Worker thread** for the workbook build, so the main thread never stalls.
3. **Background job:** endpoint returns a job id, file goes to S3, UI is notified over the existing WebSocket. Overkill for this data size.

## Recommendation
Do option 1 only. Revisit options 2/3 if exports are measured slow or other report exports are added.

## Status
Open. Nothing implemented.
