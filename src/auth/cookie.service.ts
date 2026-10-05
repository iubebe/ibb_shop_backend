import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import {
  ACCESS_COOKIE,
  AUTH_CONFIG,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
} from './auth.constants.js';
import type { AuthConfig } from './auth.config.js';

@Injectable()
export class CookieService {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  setAuthCookies(res: Response, tokens: { access: string; refresh: string }) {
    res.cookie(ACCESS_COOKIE, tokens.access, {
      ...this.base(true),
      path: '/',
      maxAge: this.config.accessTtlSeconds * 1000,
    });
    res.cookie(REFRESH_COOKIE, tokens.refresh, {
      ...this.base(true),
      path: REFRESH_COOKIE_PATH,
      maxAge: this.config.refreshTtlSeconds * 1000,
    });
  }

  clearAuthCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { ...this.base(true), path: '/' });
    res.clearCookie(REFRESH_COOKIE, {
      ...this.base(true),
      path: REFRESH_COOKIE_PATH,
    });
  }

  /** Readable by JS on purpose: the client copies it into `X-CSRF-Token`. */
  setCsrfCookie(res: Response, token: string) {
    res.cookie(CSRF_COOKIE, token, {
      ...this.base(false),
      path: '/',
      maxAge: this.config.refreshTtlSeconds * 1000,
    });
  }

  private base(httpOnly: boolean): CookieOptions {
    return {
      httpOnly,
      secure: this.config.cookie.secure,
      sameSite: this.config.cookie.sameSite,
      domain: this.config.cookie.domain,
    };
  }
}
