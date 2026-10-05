import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { CSRF_COOKIE, CSRF_HEADER } from '../auth.constants.js';
import { CsrfService } from '../csrf.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** HTTP only: every unsafe request needs a matching, signed CSRF token. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrf: CsrfService) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (
      !this.csrf.validate(req.cookies?.[CSRF_COOKIE], req.headers[CSRF_HEADER])
    ) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
