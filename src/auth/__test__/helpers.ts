import type { AuthConfig } from '../auth.config.js';

export const authConfig: AuthConfig = {
  accessSecret: 'a'.repeat(40),
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604800,
  csrfSecret: 'c'.repeat(40),
  cookie: { secure: false, sameSite: 'lax' },
  allowedOrigins: ['http://localhost:5173'],
};
