import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CSRF_COOKIE, CSRF_HEADER } from '../auth.constants.js';
import { SERVICE_AUTH_KEY } from '../decorators/service-auth.decorator.js';
import { CsrfService } from '../csrf.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * HTTP only: every unsafe request needs a matching, signed CSRF token, except
 * `@ServiceAuth()` routes.
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
    if (SAFE_METHODS.has(req.method)) return true;
    // Bearer-token routes carry no cookie session; the token guard protects them.
    if (
      this.reflector.getAllAndOverride<boolean>(SERVICE_AUTH_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    ) {
      return true;
    }
    if (
      !this.csrf.validate(req.cookies?.[CSRF_COOKIE], req.headers[CSRF_HEADER])
    ) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
