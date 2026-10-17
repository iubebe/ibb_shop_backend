import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import { BranchesService } from './branches.service.js';
import { UpdateBranchDto } from './dto/branch.dto.js';

@Roles(UserRole.ADMIN)
@Controller('branch')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  /** Every signed-in role needs the shop name (shell header, receipts). */
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CASHIER)
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.branches.get(user.branchId);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateBranchDto) {
    return this.branches.update(user.branchId, dto);
  }
}
