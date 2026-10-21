import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { RequireCsrf } from '../../auth/decorators/require-csrf.decorator.js';
import { Public } from '../../auth/decorators/public.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import { StrictThrottle } from '../../throttle/decorators.js';
import { BranchesService } from './branches.service.js';
import { UpdateBranchDto } from './dto/branch.dto.js';

@Controller('branch')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  /** Shop name only, for the login page and the browser tab title before sign-in. Needs the CSRF token and the strict rate limit. */
  @StrictThrottle()
  @RequireCsrf()
  @Public()
  @Get('public')
  getPublic() {
    return this.branches.getPublicName();
  }

  /** Every signed-in role needs the shop name (shell header, receipts). */
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CASHIER)
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.branches.get(user.branchId);
  }

  @Roles(UserRole.ADMIN)
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateBranchDto) {
    return this.branches.update(user.branchId, dto);
  }
}
