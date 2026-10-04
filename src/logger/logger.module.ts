import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

export const TRACE_ID_HEADER = 'x-trace-id';

const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
];

/** Reuse the caller's trace id (e.g. from guest/pos/sms) or mint a new one. */
export function genTraceId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers[TRACE_ID_HEADER];
  const traceId =
    typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming)
      ? incoming
      : randomUUID();
  res.setHeader(TRACE_ID_HEADER, traceId);
  return traceId;
}

/**
 * Structured logging (pino). Every log line written during a request,
 * including `new Logger(X).log()` calls inside services, carries `traceId`.
 *
 * Env: LOG_LEVEL (info; debug in dev), LOG_PRETTY (true = human readable)
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get('NODE_ENV') === 'production';
        const level = config.get<string>(
          'LOG_LEVEL',
          isProd ? 'info' : 'debug',
        );
        const pretty = config.get('LOG_PRETTY', String(!isProd)) === 'true';
        return {
          pinoHttp: {
            level: LOG_LEVELS.includes(level) ? level : 'info',
            genReqId: genTraceId,
            customProps: (req) => ({ traceId: req.id }),
            // keep per-line context small; traceId is added by customProps
            serializers: {
              req: (req: { id: string; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
            },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            autoLogging: { ignore: (req) => req.url === '/api/health' },
            transport: pretty
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
