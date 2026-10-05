import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import type { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenStore } from './refresh-token.store.js';
import { TokenService } from './token.service.js';

export interface SessionTokens {
  access: string;
  refresh: string;
}

export type PublicUser = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'branchId' | 'mustChangePassword'
>;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly refreshStore: RefreshTokenStore,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ user: PublicUser; tokens: SessionTokens }> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();

    if (!user) {
      await this.passwords.verifyDummy(password);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Checked after the password so the message only reaches the account owner.
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const session = await this.refreshStore.create(user.id);
    const access = await this.tokens.signAccessToken({
      sub: user.id,
      role: user.role,
      branchId: user.branchId,
      sid: session.sessionId,
      mcp: user.mustChangePassword,
    });
    return {
      user: toPublic(user),
      tokens: { access, refresh: session.token },
    };
  }

  /** Rotates the refresh token and re-reads the role from the database. */
  async refresh(refreshToken: string | undefined): Promise<SessionTokens> {
    const result = await this.refreshStore.rotate(refreshToken);
    if (result.status === 'reused') {
      this.logger.warn('Refresh token reuse detected, session revoked');
    }
    if (result.status !== 'ok') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.users.findOneBy({ id: result.userId });
    if (!user?.isActive) {
      await this.refreshStore.revokeSession(result.sessionId);
      throw new UnauthorizedException('Invalid refresh token');
    }
    const access = await this.tokens.signAccessToken({
      sub: user.id,
      role: user.role,
      branchId: user.branchId,
      sid: result.sessionId,
      mcp: user.mustChangePassword,
    });
    return { access, refresh: result.token };
  }

  /**
   * Sets a new password (clearing `mustChangePassword`), ends every existing
   * session and starts a fresh one.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ user: PublicUser; tokens: SessionTokens }> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOne();
    if (!user) throw new UnauthorizedException();
    if (!(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must differ from the current one',
      );
    }

    user.passwordHash = await this.passwords.hash(newPassword);
    user.mustChangePassword = false;
    await this.users.save(user);

    await this.refreshStore.revokeAllForUser(user.id);
    const session = await this.refreshStore.create(user.id);
    const access = await this.tokens.signAccessToken({
      sub: user.id,
      role: user.role,
      branchId: user.branchId,
      sid: session.sessionId,
      mcp: false,
    });
    return {
      user: toPublic(user),
      tokens: { access, refresh: session.token },
    };
  }

  logout(refreshToken: string | undefined): Promise<void> {
    return this.refreshStore.revoke(refreshToken);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user?.isActive) throw new UnauthorizedException();
    return toPublic(user);
  }
}

function toPublic(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    mustChangePassword: user.mustChangePassword,
  };
}
