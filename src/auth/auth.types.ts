import type { Request } from 'express';
import type { UserRole } from '../database/enums.js';

/** Claims inside the access token. `role` is what the guards authorize on. */
export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  branchId: string;
  /** Refresh-session id, links the access token to its Redis session. */
  sid: string;
  /** Password change pending: only change-password/me/logout are allowed. */
  mcp: boolean;
}

export interface AuthUser {
  id: string;
  role: UserRole;
  branchId: string;
  sessionId: string;
  mustChangePassword: boolean;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };
