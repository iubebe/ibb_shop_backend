import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { UserRole } from '../../database/enums.js';
import { CsrfService } from '../csrf.service.js';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { AuthGuard } from '../guards/auth.guard.js';
import { CsrfGuard } from '../guards/csrf.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import type { TokenService } from '../token.service.js';
import { authConfig } from './helpers.js';

const user = {
  id: 'u1',
  role: UserRole.CASHIER,
  branchId: 'b',
  sessionId: 's',
  mustChangePassword: false,
};

function httpCtx(req: object): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

function wsCtx(client: object): ExecutionContext {
  return {
    getType: () => 'ws',
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToWs: () => ({ getClient: () => client }),
  } as never;
}

function reflectorWith(meta: Record<string, unknown>) {
  return {
    getAllAndOverride: (key: string) => meta[key],
  } as unknown as Reflector;
}

describe('CsrfGuard', () => {
  const csrf = new CsrfService(authConfig);
  const guard = new CsrfGuard(csrf);
  const token = csrf.generate();

  it('lets safe methods through', () => {
    expect(guard.canActivate(httpCtx({ method: 'GET', headers: {} }))).toBe(
      true,
    );
  });

  it('requires a valid token on unsafe methods', () => {
    const bad = httpCtx({ method: 'POST', headers: {}, cookies: {} });
    expect(() => guard.canActivate(bad)).toThrow(ForbiddenException);
    const ok = httpCtx({
      method: 'POST',
      headers: { 'x-csrf-token': token },
      cookies: { csrf_token: token },
    });
    expect(guard.canActivate(ok)).toBe(true);
  });

  it('ignores WebSocket contexts', () => {
    expect(guard.canActivate(wsCtx({}))).toBe(true);
  });
});

describe('AuthGuard', () => {
  const verify = vi.fn();
  const tokens = { verifyAccessToken: verify } as unknown as TokenService;

  beforeEach(() => verify.mockReset());

  it('skips @Public() routes', async () => {
    const guard = new AuthGuard(
      reflectorWith({ [IS_PUBLIC_KEY]: true }),
      tokens,
    );
    expect(await guard.canActivate(httpCtx({}))).toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('authenticates HTTP from the access cookie and sets req.user', async () => {
    verify.mockResolvedValue(user);
    const req: Record<string, unknown> = { cookies: { access_token: 't' } };
    const guard = new AuthGuard(reflectorWith({}), tokens);
    expect(await guard.canActivate(httpCtx(req))).toBe(true);
    expect(verify).toHaveBeenCalledWith('t');
    expect(req.user).toBe(user);
  });

  it('rejects HTTP without a valid token', async () => {
    verify.mockResolvedValue(null);
    const guard = new AuthGuard(reflectorWith({}), tokens);
    await expect(guard.canActivate(httpCtx({ cookies: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('authenticates WS from the handshake cookie header', async () => {
    verify.mockResolvedValue(user);
    const client = {
      handshake: { headers: { cookie: 'a=1; access_token=wt' } },
      data: {} as Record<string, unknown>,
    };
    const guard = new AuthGuard(reflectorWith({}), tokens);
    expect(await guard.canActivate(wsCtx(client))).toBe(true);
    expect(verify).toHaveBeenCalledWith('wt');
    expect(client.data.user).toBe(user);
  });

  it('blocks a flagged user except on allow-listed routes (HTTP)', async () => {
    verify.mockResolvedValue({ ...user, mustChangePassword: true });
    const req = { cookies: { access_token: 't' } };
    const blocked = new AuthGuard(reflectorWith({}), tokens);
    await expect(blocked.canActivate(httpCtx(req))).rejects.toThrow(
      ForbiddenException,
    );
    const allowed = new AuthGuard(
      reflectorWith({ [ALLOW_PASSWORD_CHANGE_KEY]: true }),
      tokens,
    );
    expect(await allowed.canActivate(httpCtx(req))).toBe(true);
  });

  it('blocks a flagged user on WebSocket', async () => {
    verify.mockResolvedValue({ ...user, mustChangePassword: true });
    const client = {
      handshake: { headers: { cookie: 'access_token=t' } },
      data: {},
    };
    const guard = new AuthGuard(reflectorWith({}), tokens);
    await expect(guard.canActivate(wsCtx(client))).rejects.toThrow(WsException);
  });

  it('rejects WS with WsException', async () => {
    verify.mockResolvedValue(null);
    const client = { handshake: { headers: {} }, data: {} };
    const guard = new AuthGuard(reflectorWith({}), tokens);
    await expect(guard.canActivate(wsCtx(client))).rejects.toThrow(WsException);
  });
});

describe('RolesGuard', () => {
  it('allows any signed-in user when no roles are set', () => {
    const guard = new RolesGuard(reflectorWith({}));
    expect(guard.canActivate(httpCtx({ user }))).toBe(true);
  });

  it('allows a listed role and blocks others (HTTP)', () => {
    const guard = new RolesGuard(
      reflectorWith({ [ROLES_KEY]: [UserRole.ADMIN, UserRole.CASHIER] }),
    );
    expect(guard.canActivate(httpCtx({ user }))).toBe(true);
    expect(() =>
      guard.canActivate(httpCtx({ user: { ...user, role: UserRole.STAFF } })),
    ).toThrow(ForbiddenException);
  });

  it('blocks on WebSocket with WsException', () => {
    const guard = new RolesGuard(
      reflectorWith({ [ROLES_KEY]: [UserRole.ADMIN] }),
    );
    expect(() => guard.canActivate(wsCtx({ data: { user } }))).toThrow(
      WsException,
    );
  });
});
