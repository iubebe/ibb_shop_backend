import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CSRF_COOKIE, CSRF_HEADER } from '../auth.constants.js';
import { REQUIRE_CSRF_KEY } from '../decorators/require-csrf.decorator.js';
import { CsrfService } from '../csrf.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * HTTP only: every unsafe request needs a matching, signed CSRF token, and so
 * does any route marked `@RequireCsrf()`.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly csrf: CsrfService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const required = this.reflector.getAllAndOverride<boolean | undefined>(
      REQUIRE_CSRF_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (SAFE_METHODS.has(req.method) && !required) return true;
    if (
      !this.csrf.validate(req.cookies?.[CSRF_COOKIE], req.headers[CSRF_HEADER])
    ) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
