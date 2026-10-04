import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../auth.types.js';
import { getAuthUser } from '../auth-context.js';

/** The authenticated user, for both HTTP and WebSocket handlers. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    getAuthUser(ctx),
);
