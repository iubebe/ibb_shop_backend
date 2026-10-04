import type { ConfigService } from '@nestjs/config';

export interface AuthConfig {
  accessSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  csrfSecret: string;
  cookie: {
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    domain?: string;
  };
  allowedOrigins: string[];
}

export function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function secret(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (!value || value.length < 32) {
    throw new Error(`${key} must be set to at least 32 characters`);
  }
  return value;
}

/**
 * Env: JWT_ACCESS_SECRET, CSRF_SECRET (both >= 32 chars, required),
 * ACCESS_TOKEN_TTL (900 s), REFRESH_TOKEN_TTL (604800 s = 7 d),
 * COOKIE_SECURE (true in production), COOKIE_SAMESITE (lax), COOKIE_DOMAIN,
 * CORS_ORIGINS (comma separated; also checked on WebSocket handshakes)
 */
export function loadAuthConfig(config: ConfigService): AuthConfig {
  const isProd = config.get('NODE_ENV') === 'production';
  const sameSite = config.get<string>('COOKIE_SAMESITE', 'lax');
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    throw new Error('COOKIE_SAMESITE must be lax, strict or none');
  }
  const secure = config.get('COOKIE_SECURE', String(isProd)) === 'true';
  if (sameSite === 'none' && !secure) {
    throw new Error('COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
  }
  return {
    accessSecret: secret(config, 'JWT_ACCESS_SECRET'),
    accessTtlSeconds: Number(config.get('ACCESS_TOKEN_TTL', 900)),
    refreshTtlSeconds: Number(config.get('REFRESH_TOKEN_TTL', 604800)),
    csrfSecret: secret(config, 'CSRF_SECRET'),
    cookie: {
      secure,
      sameSite: sameSite as 'lax' | 'strict' | 'none',
      domain: config.get<string>('COOKIE_DOMAIN') || undefined,
    },
    allowedOrigins: parseOrigins(config.get<string>('CORS_ORIGINS')),
  };
}
