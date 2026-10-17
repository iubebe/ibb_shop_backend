import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../guards/service-token.guard.js';
import { Public } from './public.decorator.js';

export const SERVICE_AUTH_KEY = 'serviceAuth';

/**
 * Machine-to-machine route: no cookie session, only the bearer
 * `FORECAST_API_TOKEN`. Skips the user guard and CSRF (a bearer header is not
 * sent automatically by browsers, so CSRF does not apply) and enforces the
 * token instead.
 */
export const ServiceAuth = () =>
  applyDecorators(
    SetMetadata(SERVICE_AUTH_KEY, true),
    Public(),
    UseGuards(ServiceTokenGuard),
  );
