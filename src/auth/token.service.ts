import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_CONFIG } from './auth.constants.js';
import type { AuthConfig } from './auth.config.js';
import type { AccessTokenPayload, AuthUser } from './auth.types.js';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.accessSecret,
      algorithm: 'HS256',
      expiresIn: this.config.accessTtlSeconds,
    });
  }

  /** Returns the user, or null when the token is missing/invalid/expired. */
  async verifyAccessToken(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null;
    try {
      const p = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.accessSecret,
        algorithms: ['HS256'],
      });
      return {
        id: p.sub,
        role: p.role,
        branchId: p.branchId,
        sessionId: p.sid,
        mustChangePassword: p.mcp === true,
      };
    } catch {
      return null;
    }
  }
}
