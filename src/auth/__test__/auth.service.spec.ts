import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../database/enums.js';
import { AuthService } from '../auth.service.js';

const dbUser = {
  id: 'u1',
  name: 'N',
  email: 'e@x.io',
  role: UserRole.STAFF,
  branchId: 'b1',
  passwordHash: 'hash',
  mustChangePassword: false,
  isActive: true,
};

function setup() {
  const qb = {
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    getOne: vi.fn(),
  };
  const users = {
    createQueryBuilder: vi.fn(() => qb),
    findOneBy: vi.fn(),
    save: vi.fn(async (u: unknown) => u),
  };
  const passwords = {
    verify: vi.fn(),
    verifyDummy: vi.fn(),
    hash: vi.fn().mockResolvedValue('new-hash'),
  };
  const tokens = { signAccessToken: vi.fn().mockResolvedValue('access') };
  const store = {
    create: vi.fn().mockResolvedValue({ sessionId: 's1', token: 's1.r' }),
    rotate: vi.fn(),
    revoke: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllForUser: vi.fn(),
  };
  const logger = { setContext: vi.fn(), warn: vi.fn() };
  const service = new AuthService(
    users as never,
    passwords as never,
    tokens as never,
    store as never,
    logger as never,
  );
  return { service, qb, users, passwords, tokens, store, logger };
}

describe('AuthService', () => {
  it('logs in: binds role/branch/session into the access token, hides the hash', async () => {
    const { service, qb, passwords, tokens } = setup();
    qb.getOne.mockResolvedValue(dbUser);
    passwords.verify.mockResolvedValue(true);
    const res = await service.login('E@x.io', 'pw');
    expect(tokens.signAccessToken).toHaveBeenCalledWith({
      sub: 'u1',
      role: UserRole.STAFF,
      branchId: 'b1',
      sid: 's1',
      mcp: false,
    });
    expect(res.tokens).toEqual({ access: 'access', refresh: 's1.r' });
    expect(res.user).not.toHaveProperty('passwordHash');
  });

  it('uses the same error for unknown email and wrong password', async () => {
    const { service, qb, passwords } = setup();
    qb.getOne.mockResolvedValueOnce(null);
    await expect(service.login('a@b.c', 'pw')).rejects.toThrow(
      'Invalid credentials',
    );
    expect(passwords.verifyDummy).toHaveBeenCalled();
    qb.getOne.mockResolvedValueOnce(dbUser);
    passwords.verify.mockResolvedValue(false);
    await expect(service.login('a@b.c', 'pw')).rejects.toThrow(
      'Invalid credentials',
    );
  });

  it('refresh re-reads the role from the database', async () => {
    const { service, users, store, tokens } = setup();
    store.rotate.mockResolvedValue({
      status: 'ok',
      userId: 'u1',
      sessionId: 's1',
      token: 's1.new',
    });
    users.findOneBy.mockResolvedValue({ ...dbUser, role: UserRole.ADMIN });
    const res = await service.refresh('s1.old');
    expect(tokens.signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.ADMIN }),
    );
    expect(res.refresh).toBe('s1.new');
  });

  it('refresh rejects invalid tokens and warns on reuse', async () => {
    const { service, store, logger } = setup();
    store.rotate.mockResolvedValue({ status: 'reused' });
    await expect(service.refresh('x.y')).rejects.toThrow(UnauthorizedException);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('login rejects a disabled account after a correct password', async () => {
    const { service, qb, passwords, store } = setup();
    qb.getOne.mockResolvedValue({ ...dbUser, isActive: false });
    passwords.verify.mockResolvedValue(true);
    await expect(service.login('e@x.io', 'pw')).rejects.toThrow('Account is disabled');
    expect(store.create).not.toHaveBeenCalled();
  });

  it('refresh revokes the session of a disabled user', async () => {
    const { service, users, store } = setup();
    store.rotate.mockResolvedValue({ status: 'ok', userId: 'u1', sessionId: 's1', token: 't' });
    users.findOneBy.mockResolvedValue({ ...dbUser, isActive: false });
    await expect(service.refresh('s1.old')).rejects.toThrow(UnauthorizedException);
    expect(store.revokeSession).toHaveBeenCalledWith('s1');
  });

  it('refresh revokes the session when the user no longer exists', async () => {
    const { service, users, store } = setup();
    store.rotate.mockResolvedValue({
      status: 'ok',
      userId: 'gone',
      sessionId: 's1',
      token: 't',
    });
    users.findOneBy.mockResolvedValue(null);
    await expect(service.refresh('s1.old')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(store.revokeSession).toHaveBeenCalledWith('s1');
  });

  describe('changePassword', () => {
    it('stores the new hash, clears the flag, resets all sessions', async () => {
      const { service, qb, passwords, users, store, tokens } = setup();
      qb.getOne.mockResolvedValue({ ...dbUser, mustChangePassword: true });
      passwords.verify.mockResolvedValue(true);
      const res = await service.changePassword('u1', 'old', 'new-password-1');
      expect(users.save).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: 'new-hash',
          mustChangePassword: false,
        }),
      );
      expect(store.revokeAllForUser).toHaveBeenCalledWith('u1');
      expect(tokens.signAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ mcp: false }),
      );
      expect(res.user.mustChangePassword).toBe(false);
    });

    it('rejects a wrong current password and an unchanged password', async () => {
      const { service, qb, passwords, users } = setup();
      qb.getOne.mockResolvedValue({ ...dbUser });
      passwords.verify.mockResolvedValueOnce(false);
      await expect(
        service.changePassword('u1', 'bad', 'new-password-1'),
      ).rejects.toThrow(UnauthorizedException);
      passwords.verify.mockResolvedValueOnce(true);
      await expect(
        service.changePassword('u1', 'same-password', 'same-password'),
      ).rejects.toThrow('differ');
      expect(users.save).not.toHaveBeenCalled();
    });
  });
});
