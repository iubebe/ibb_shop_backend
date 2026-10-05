import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assertValidNewPassword } from '../../auth/password-policy.js';
import { PasswordService } from '../../auth/password.service.js';
import { RefreshTokenStore } from '../../auth/refresh-token.store.js';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity.js';
import { User } from '../../database/entities/user.entity.js';
import type { UserRole } from '../../database/enums.js';
import type { UserView } from './users.types.js';

interface UserPatch {
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * Admin CRUD for accounts, always scoped to the caller's branch. Admins can't
 * lock themselves out (no self role change, disable, reset or delete), which
 * also guarantees at least one active admin remains.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly passwords: PasswordService,
    private readonly sessions: RefreshTokenStore,
  ) {}

  async list(branchId: string): Promise<UserView[]> {
    const rows = await this.users.find({
      where: { branchId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(view);
  }

  async create(
    branchId: string,
    dto: { name: string; email: string; role: UserRole; password: string },
  ): Promise<UserView> {
    assertValidNewPassword(dto.password);
    await this.assertEmailFree(dto.email);
    const saved = await this.users.save(
      this.users.create({
        branchId,
        name: dto.name,
        email: dto.email,
        role: dto.role,
        passwordHash: await this.passwords.hash(dto.password),
        mustChangePassword: true,
        isActive: true,
      }),
    );
    return view(saved);
  }

  async update(
    branchId: string,
    actorId: string,
    id: string,
    patch: UserPatch,
  ): Promise<UserView> {
    const user = await this.find(branchId, id);
    const isSelf = id === actorId;
    const roleChanged = patch.role !== undefined && patch.role !== user.role;
    const disabling = patch.isActive === false && user.isActive;
    if (isSelf && (roleChanged || disabling)) {
      throw new ForbiddenException(
        'You cannot change your own role or disable your own account',
      );
    }
    if (patch.email !== undefined && patch.email !== user.email) {
      await this.assertEmailFree(patch.email, id);
    }

    if (patch.name !== undefined) user.name = patch.name;
    if (patch.email !== undefined) user.email = patch.email;
    if (patch.role !== undefined) user.role = patch.role;
    if (patch.isActive !== undefined) user.isActive = patch.isActive;
    const saved = await this.users.save(user);

    // The refresh path re-reads role and isActive, so ending sessions makes
    // the change effective once the short-lived access token expires.
    if (roleChanged || disabling) await this.sessions.revokeAllForUser(id);
    return view(saved);
  }

  /** Sets a temporary password; the user must change it at next login. */
  async resetPassword(
    branchId: string,
    actorId: string,
    id: string,
    password: string,
  ): Promise<void> {
    if (id === actorId) {
      throw new BadRequestException(
        'Use the change-password screen for your own account',
      );
    }
    assertValidNewPassword(password);
    const user = await this.find(branchId, id);
    user.passwordHash = await this.passwords.hash(password);
    user.mustChangePassword = true;
    await this.users.save(user);
    await this.sessions.revokeAllForUser(id);
  }

  /** Accounts with attendance history can only be disabled, not deleted. */
  async remove(branchId: string, actorId: string, id: string): Promise<void> {
    if (id === actorId) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    const user = await this.find(branchId, id);
    const records = await this.users.manager.countBy(AttendanceRecord, {
      userId: id,
    });
    if (records > 0) {
      throw new ConflictException(
        'This account has check-in history; disable it instead',
      );
    }
    await this.users.remove(user);
    await this.sessions.revokeAllForUser(id);
  }

  private async find(branchId: string, id: string): Promise<User> {
    const user = await this.users.findOneBy({ id, branchId });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async assertEmailFree(email: string, exceptId?: string) {
    const clash = await this.users
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
    if (clash && clash.id !== exceptId) {
      throw new ConflictException('Email is already in use');
    }
  }
}

function view(user: User): UserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}
