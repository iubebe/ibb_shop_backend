import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { parseOrigins } from './auth/auth.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // Cookie auth needs explicit origins; `*` can't be combined with credentials.
  app.enableCors({
    origin: parseOrigins(app.get(ConfigService).get<string>('CORS_ORIGINS')),
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
