# Logger: Pino with log level and trace id

Date: 04/10/2026

## Decision
Use Pino (`nestjs-pino`) instead of Nest's built-in `ConsoleLogger`.
- Why: structured JSON for collection and search, per-request context via AsyncLocalStorage (so a trace id reaches logs from any service without passing it around), built-in redaction, low overhead.
- Native logger kept the simpler API, but has no request context and no JSON-by-default. Existing `new Logger(X)` calls keep working and now go through Pino.

## What was done
- `src/logger/logger.module.ts`: `LoggerModule` (imported in `AppModule`), `main.ts` uses `bufferLogs` + `app.useLogger`.
- Trace id: reads `x-trace-id` from the request if valid (`[\w-]{8,64}`), else generates a UUID. It is echoed in the response header and attached as `traceId` to every log line of that request.
- Env: `LOG_LEVEL` (default `debug`, `info` in production), `LOG_PRETTY` (default true outside production; set false for JSON).
- Redacts `authorization` and `cookie` headers; `/api/health` requests are not logged.
- Verified by running the built app: service logs and access logs share the `traceId`, and a supplied `x-trace-id` is propagated.

## Pending / next
- WebSocket (`EventsGateway`) messages have no trace id yet; guest/pos/sms should send `x-trace-id` on REST calls to link flows.
- Forwarding the trace id to downstream calls (once any exist).

## Follow-up: migrate existing logger usage
- Only `src/redis/redis.service.ts` used Nest's `Logger`. It now injects `PinoLogger` with `@InjectPinoLogger(RedisService.name)` (errors logged as `{ err }`). No `console.*` calls exist in `src`.
- Convention: inject `PinoLogger` (global, transient) and call `this.logger.setContext(<Class>.name)` in the constructor; don't use `new Logger()`. Tests provide `{ provide: PinoLogger, useValue: mock }`.
- Do NOT use `@InjectPinoLogger()`: nestjs-pino registers those providers when `LoggerModule.forRoot` is evaluated, which happens at import time of `logger.module.ts`, before later-imported classes register their decorators. Result: `UnknownDependenciesException ... PinoLogger:RedisService` at startup, while unit tests still pass because of a different import order.
