import { SetMetadata } from '@nestjs/common';

export const REQUIRE_CSRF_KEY = 'requireCsrf';

/** Makes a safe-method (GET) route demand the CSRF token like an unsafe one. */
export const RequireCsrf = () => SetMetadata(REQUIRE_CSRF_KEY, true);
