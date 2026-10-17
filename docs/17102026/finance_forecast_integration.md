# Forecast integration: data structure for the local model — 17/10/2026

Contract between the backend (VPS) and the forecasting job on the Mac mini. Context and design: `forecast_proposal.md`, `finance_monitoring.md`. Schema version: **1**.

## Flow
1. The mini pulls history: `GET /api/finance/export`.
2. It fits models, backtests, produces predictions (and optionally LLM commentary).
3. It pushes the result: `POST /api/finance/forecasts`.
4. Admins read it in the SMS via `GET /api/finance/forecasts/latest` (cookie login, admin only; not for the model).

The mini always connects out to the VPS; nothing is exposed on the mini.

## Auth and setup
- Header on both model endpoints: `Authorization: Bearer <FORECAST_API_TOKEN>`. No cookies, no CSRF header.
- Backend env: `FORECAST_API_TOKEN` (≥ 32 chars, e.g. `openssl rand -hex 32`; empty = integration off, every call 401) and optional `FORECAST_BRANCH_ID` (needed only if there is not exactly one branch; otherwise 400 "Set FORECAST_BRANCH_ID"). Not yet added to `ibb_shop_release` compose/envs.
- Wrong or missing token: `401`. Rate limiting applies (global throttle); one pull and one push per night is far below it.
- Base URL: the backend API (`https://<api host>/api`). Max JSON body ~100 KB.

## Conventions
- Money: VND, plain JSON numbers (no thousands separators). Days: `YYYY-MM-DD` in the shop timezone (`timezone` field, default `Asia/Ho_Chi_Minh`). `dow` is ISO weekday (1 = Monday … 7 = Sunday). Timestamps: ISO 8601 UTC.
- Revenue counts paid orders by payment time (cancelled/unpaid excluded). Cost lines are cash basis.

## `GET /api/finance/export?from=YYYY-MM-DD&to=YYYY-MM-DD`
`[from, to)`, at most 1100 days. Errors `400`: bad date, `from >= to`, range too long. Ask for the full history (e.g. from the shop's first order) each night; it is small.

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-17T09:51:32.860Z",
  "timezone": "Asia/Ho_Chi_Minh",
  "currency": "VND",
  "from": "2026-10-14", "to": "2026-10-18",
  "today": "2026-10-17",                 // today in shop timezone
  "daily": [                              // dense: one row per day in [from, to)
    {
      "date": "2026-10-16", "dow": 5,
      "revenue": 100000,                  // sum of paid order totals
      "orders": 1,                        // paid orders
      "importCost": 0,                    // stock import receipts that day
      "salaryCost": 0,                    // estimate: completed sessions' hours x hourlyRate (check-in day)
      "hoursWorked": 0,
      "operatingCost": 100000,            // = sum(expenses)
      "expenses": { "rent": 0, "electricity": 0, "water": 100000, "internet": 0,
                    "gas": 0, "maintenance": 0, "marketing": 0, "other": 0 },
      "partial": false                    // true for today (and later): still incomplete, DO NOT train on it
    }
  ],
  "stockItems": [                         // current state
    { "id": "uuid", "name": "Cà phê hạt", "kind": "material", "unit": "kg",
      "quantity": 12.5, "lowStockThreshold": 5, "lastUnitCost": 250000, "isActive": true }
  ],
  "importLines": [                        // sparse: one row per receipt line
    { "date": "2026-10-10", "stockItemId": "uuid", "quantity": 20, "unitCost": 240000 }
  ],
  "stockAdjustments": [                   // sparse: signed stocktake/waste per day and item
    { "date": "2026-10-12", "stockItemId": "uuid", "change": -1.5 }
  ],
  "roster": [                             // assigned (approved) shifts from `from` to today+60d
    { "date": "2026-10-20", "userId": "uuid", "hours": 8, "hourlyRate": 30000 }  // hourlyRate null = not set
  ]
}
```
Notes for the model:
- Training rows: `partial == false`. Days with no sales are real zeros (shop closed or no orders); they are not missing data.
- `daily.salaryCost` is realized pay; for the future use `roster`: `sum(hours x hourlyRate)` per date, which is more accurate than any statistical forecast. Staff with `hourlyRate: null` are unpriced (understated).
- Imports usage: there is no sales-side deduction yet, so per-item consumption is only visible indirectly (`importLines`, `stockAdjustments`, `quantity`). Forecast the **total** `importCost` first; per-item days-of-cover is a later step.
- `expenses` are entered by an admin when bills arrive, so utility days are lumpy (one entry a month). Model utilities at monthly level or spread, not as daily series.
- No personal data other than opaque `userId`s.

## `POST /api/finance/forecasts`
Body (`application/json`). One call = one forecast run; the backend keeps the latest 30 runs.

```jsonc
{
  "generatedAt": "2026-10-17T20:00:00Z",   // required, ISO 8601
  "modelName": "chronos-t5-small+seasonal", // required, <= 60 chars
  "modelVersion": "2026.10.1",              // required, <= 40 chars
  "dataThrough": "2026-10-16",              // required: last day of data used
  "horizonDays": 30,                        // required, 1..60
  "points": [                               // required, 1..1000 items
    { "metric": "revenue",    "date": "2026-10-17", "p50": 1000000, "p10": 800000, "p90": 1300000 },
    { "metric": "salaryCost", "date": "2026-10-17", "p50": 300000 },
    { "metric": "operatingCost:electricity", "date": "2026-10-31", "p50": 700000, "p90": 850000 }
  ],
  "backtest": [                             // optional, <= 20 items
    { "metric": "revenue", "samples": 30, "mape": 0.12, "baselineMape": 0.2 }
  ],
  "commentary": "Điện dự kiến tăng ..."     // optional, <= 4000 chars, shown to the admin as plain text
}
```

**Metrics** (`metric`): `revenue`, `importCost`, `salaryCost`, `operatingCost`, or `operatingCost:<category>` with category in `rent|electricity|water|internet|gas|maintenance|marketing|other`. Send either the aggregate `operatingCost` or the per-category lines (if both are sent the aggregate wins in totals). Anything else: `400`.

**Rules (`400` with a message when broken):**
- `date` must be a real day in `dataThrough+1 … dataThrough+horizonDays`.
- No duplicate `(metric, date)`.
- `p50 >= 0`; when given, `p10 <= p50 <= p90`. `p10`/`p90` are optional per point (low/high band, e.g. 10th/90th percentile).
- Backtest `mape`/`baselineMape` are fractions (0.12 = 12%); `samples` is the number of backtest windows. Only keep a model whose `mape` clearly beats `baselineMape`.

**Response `201`**: the stored run plus the backend-computed summary (same shape as `GET /forecasts/latest`):
```jsonc
{
  "id": "uuid", "generatedAt": "...", "receivedAt": "...",
  "modelName": "...", "modelVersion": "...", "dataThrough": "2026-10-16", "horizonDays": 30,
  "points": [ ... ], "backtest": [ ... ], "commentary": "...",
  "summary": {
    "from": "2026-10-17", "to": "2026-11-15",
    "revenue":       { "p50": 28000000, "high": 33000000 },
    "importCost":    { "p50": 9000000,  "high": 11000000 },
    "salaryCost":    { "p50": 10000000, "high": 10500000 },
    "operatingCost": { "p50": 4000000,  "high": 4400000 },
    "totalCost":     { "p50": 23000000, "high": 25900000 },
    "fundNeeded":    { "p50": 23000000, "high": 25900000 },  // money to keep aside
    "expectedNet": 5000000                                  // revenue.p50 - totalCost.p50
  }
}
```
`high` = sum of `p90` (falls back to `p50` where a point has no band). The backend does this arithmetic so the model side does not need to; do not send your own totals.

## Suggested job (mini, nightly via launchd)
1. `GET export` for full history; drop `partial` rows; build per-metric daily series from `daily` (`revenue`, `importCost`, `operatingCost`; `salaryCost` from `roster` for the future).
2. Baseline per metric: mean of the last 8 same weekdays × 4-week trend factor. Backtest by rolling origin (e.g. 8 windows of 14–30 days); compute `mape` for the baseline and for any ML model (Chronos/TimesFM/LightGBM).
3. Pick per metric the better of model and baseline; take quantiles (p10/p90) from the model or from backtest residuals.
4. Optionally have the local LLM write `commentary` from the **computed** numbers only.
5. `POST forecasts` with `dataThrough` = yesterday's date. Retry with backoff on 5xx/network errors; a `400` means fix the payload, do not retry. If the mini is down, the last forecast simply stays (its `generatedAt`/`dataThrough` tell how old it is).

## Verified (2026-10-17)
Built app on a throwaway DB: export (dense days, partial flag, overnight shift = 8 h in roster, single-branch resolution), push + summary, and the error cases (no/bad token 401, bad range, duplicate point, out-of-horizon, p10 > p50, unknown metric, `GET latest` anonymous 401, POST without token 401, POST with token but no CSRF header accepted). Guard unit tests added in `src/auth/__test__/guards.spec.ts`.

## Not done / next
- Migration `1792310000000-FinanceForecasts.ts` not applied to dev DB `ibb`; token not added to `ibb_shop_release`.
- No ibb_sms screen for the forecast yet (`GET /finance/forecasts/latest` is ready: reserve card, per-line table, backtest quality, commentary).
- The model-side script itself is not written.
- Exposure: the export holds business figures behind one bearer token; keep the VPS on HTTPS, rotate by changing the env var.
