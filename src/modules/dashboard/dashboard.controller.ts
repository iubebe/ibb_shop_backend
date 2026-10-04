import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import { DashboardService } from './dashboard.service.js';

@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CASHIER)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Queue + recent orders for everyone; `sales` only for admins. */
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.dashboard.get(user.branchId, user.role);
  }
}
