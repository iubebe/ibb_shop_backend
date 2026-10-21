import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import {
  ConfirmWriteOffDto,
  CreateWriteOffDto,
  ListWriteOffsQuery,
  RejectWriteOffDto,
} from './dto/write-off.dto.js';
import { WriteOffService } from './write-off.service.js';

/**
 * Surplus/spoiled stock. Admin acts directly; staff only propose and see
 * their own proposals (without costs).
 */
@Roles(UserRole.ADMIN)
@Controller('stock/write-offs')
export class WriteOffController {
  constructor(private readonly writeOffs: WriteOffService) {}

  /** Items that are expired, near expiry or not moving. */
  @Get('at-risk')
  atRisk(@CurrentUser() user: AuthUser) {
    return this.writeOffs.atRisk(user.branchId);
  }

  @Get('pending')
  listPending(@CurrentUser() user: AuthUser) {
    return this.writeOffs.listPending(user.branchId);
  }

  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.writeOffs.listMine(user.branchId, user.id);
  }

  /** Write-offs created in `[from, to)`. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListWriteOffsQuery) {
    return this.writeOffs.list(
      user.branchId,
      new Date(query.from),
      new Date(query.to),
    );
  }

  /** Admin: removes the stock immediately. */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWriteOffDto) {
    return this.writeOffs.createDirect(user.branchId, user.id, dto);
  }

  /** Staff: proposal for admin review; stock is not changed. */
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Post('proposals')
  propose(@CurrentUser() user: AuthUser, @Body() dto: CreateWriteOffDto) {
    return this.writeOffs.propose(user.branchId, user.id, dto);
  }

  @Post(':id/confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmWriteOffDto,
  ) {
    return this.writeOffs.confirm(user.branchId, user.id, id, dto);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectWriteOffDto,
  ) {
    return this.writeOffs.reject(user.branchId, user.id, id, dto.reason);
  }

  /** Withdraw a pending proposal (author or admin). */
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Delete(':id')
  @HttpCode(204)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.writeOffs.cancel(user.branchId, user, id);
  }
}
