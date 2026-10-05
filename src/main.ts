import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { parseOrigins } from './auth/auth.config.js';
import { loadThrottleConfig } from './throttle/throttle.config.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  // Strip unknown fields, reject bad input, turn plain bodies into DTO instances.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Behind N reverse proxies `req.ip` must come from X-Forwarded-For, or every
  // client looks like the proxy and shares one rate limit.
  const { trustProxyHops } = loadThrottleConfig(config);
  if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);

  app.use(cookieParser());
  // Cookie auth needs explicit origins; `*` can't be combined with credentials.
  app.enableCors({
    origin: parseOrigins(config.get<string>('CORS_ORIGINS')),
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0'; // '0.0.0.0' binds to all interfaces

  const server = await app.listen(port, host);
  // Slow-request (slowloris) protection; Node's defaults are 60 s / 300 s.
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
}
await bootstrap();
