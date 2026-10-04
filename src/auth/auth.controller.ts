import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { REFRESH_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import { CookieService } from './cookie.service.js';
import { CsrfService } from './csrf.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { AllowWhenPasswordChangeRequired } from './decorators/allow-password-change.decorator.js';
import { assertValidNewPassword } from './password-policy.js';
import { Public } from './decorators/public.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: CookieService,
    private readonly csrf: CsrfService,
  ) {}

  /** Call once before any unsafe request; sets the `csrf_token` cookie. */
  @Public()
  @Get('csrf')
  issueCsrf(@Res({ passthrough: true }) res: Response) {
    const csrfToken = this.csrf.generate();
    this.cookies.setCsrfCookie(res, csrfToken);
    return { csrfToken };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password } = parseLogin(body);
    const { user, tokens } = await this.auth.login(email, password);
    this.cookies.setAuthCookies(res, tokens);
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const tokens = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]);
      this.cookies.setAuthCookies(res, tokens);
      return { ok: true };
    } catch (err) {
      this.cookies.clearAuthCookies(res);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    this.cookies.clearAuthCookies(res);
  }

  /**
   * First-login reset (also a normal change-password). Allowed while the
   * account is flagged `mustChangePassword`; ends all other sessions.
   */
  @AllowWhenPasswordChangeRequired()
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() current: AuthUser,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { currentPassword, newPassword } = parseChangePassword(body);
    const { user, tokens } = await this.auth.changePassword(
      current.id,
      currentPassword,
      newPassword,
    );
    this.cookies.setAuthCookies(res, tokens);
    return { user };
  }

  @AllowWhenPasswordChangeRequired()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}

function parseLogin(body: unknown): { email: string; password: string } {
  const { email, password } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email ||
    !password ||
    email.length > 254 ||
    password.length > 1024
  ) {
    throw new BadRequestException('email and password are required');
  }
  return { email, password };
}

function parseChangePassword(body: unknown): {
  currentPassword: string;
  newPassword: string;
} {
  const { currentPassword, newPassword } = (body ?? {}) as Record<
    string,
    unknown
  >;
  if (
    typeof currentPassword !== 'string' ||
    typeof newPassword !== 'string' ||
    !currentPassword ||
    currentPassword.length > 1024
  ) {
    throw new BadRequestException(
      'currentPassword and newPassword are required',
    );
  }
  assertValidNewPassword(newPassword);
  return { currentPassword, newPassword };
}
