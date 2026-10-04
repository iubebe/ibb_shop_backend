import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity.js';
import { loadAuthConfig } from './auth.config.js';
import { AUTH_CONFIG } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CookieService } from './cookie.service.js';
import { CsrfService } from './csrf.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenStore } from './refresh-token.store.js';
import { TokenService } from './token.service.js';
import { WsAuthMiddleware } from './ws-auth.middleware.js';

/**
 * Cookie-based auth (access JWT + Redis refresh sessions + CSRF), applied
 * globally to REST and WebSocket handlers. Opt out with `@Public()`;
 * restrict with `@Roles(UserRole.ADMIN, ...)`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User]), JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_CONFIG,
      inject: [ConfigService],
      useFactory: loadAuthConfig,
    },
    AuthService,
    CookieService,
    CsrfService,
    PasswordService,
    RefreshTokenStore,
    TokenService,
    WsAuthMiddleware,
    // order matters: CSRF -> authentication -> roles
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AUTH_CONFIG, PasswordService, TokenService, WsAuthMiddleware],
})
export class AuthModule {}
