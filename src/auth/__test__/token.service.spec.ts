import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../database/enums.js';
import { TokenService } from '../token.service.js';
import { authConfig } from './helpers.js';

describe('TokenService', () => {
  const jwt = new JwtService();
  const tokens = new TokenService(jwt, authConfig);
  const payload = {
    sub: 'u1',
    role: UserRole.CASHIER,
    branchId: 'b1',
    sid: 's1',
    mcp: false,
  };

  it('round-trips the role and ids through the access token', async () => {
    const token = await tokens.signAccessToken(payload);
    expect(await tokens.verifyAccessToken(token)).toEqual({
      id: 'u1',
      role: UserRole.CASHIER,
      branchId: 'b1',
      sessionId: 's1',
      mustChangePassword: false,
    });
  });

  it('carries the must-change-password flag', async () => {
    const token = await tokens.signAccessToken({ ...payload, mcp: true });
    expect((await tokens.verifyAccessToken(token))?.mustChangePassword).toBe(
      true,
    );
  });

  it('returns null for missing, tampered or foreign tokens', async () => {
    const token = await tokens.signAccessToken(payload);
    expect(await tokens.verifyAccessToken(undefined)).toBeNull();
    expect(await tokens.verifyAccessToken(`${token}x`)).toBeNull();
    const foreign = await jwt.signAsync(payload, { secret: 'x'.repeat(40) });
    expect(await tokens.verifyAccessToken(foreign)).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const expired = await jwt.signAsync(payload, {
      secret: authConfig.accessSecret,
      expiresIn: -10,
    });
    expect(await tokens.verifyAccessToken(expired)).toBeNull();
  });

  it('rejects alg=none tokens', async () => {
    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`;
    expect(await tokens.verifyAccessToken(none)).toBeNull();
  });
});
