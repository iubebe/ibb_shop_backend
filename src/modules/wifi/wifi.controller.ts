import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  StreamableFile,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import { StrictThrottle } from '../../throttle/decorators.js';
import { UpdateWifiDto, WifiCredentialsDto } from './dto/wifi.dto.js';
import { WifiService } from './wifi.service.js';

@Roles(UserRole.ADMIN)
@Controller('wifi')
export class WifiController {
  constructor(private readonly wifi: WifiService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser() user: AuthUser) {
    return this.wifi.list(user.branchId);
  }

  /** The password is accepted here once; only the QR image is kept. */
  @Post()
  @StrictThrottle()
  @Header('Cache-Control', 'no-store')
  create(@CurrentUser() user: AuthUser, @Body() dto: WifiCredentialsDto) {
    return this.wifi.create(user.branchId, dto);
  }

  /** Rotate: send the full credentials again to rebuild the QR. */
  @Put(':id/credentials')
  @StrictThrottle()
  @Header('Cache-Control', 'no-store')
  replaceCredentials(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WifiCredentialsDto,
  ) {
    return this.wifi.replaceCredentials(user.branchId, id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWifiDto,
  ) {
    return this.wifi.setActive(user.branchId, id, dto.isActive ?? false);
  }

  /** Streams the QR image (private, admin only, never cached). */
  @Get(':id/image')
  @Header('Cache-Control', 'no-store')
  async getImage(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const img = await this.wifi.getImage(user.branchId, id);
    return new StreamableFile(img.body, {
      type: img.contentType,
      length: img.contentLength,
      disposition: 'inline',
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.wifi.remove(user.branchId, id);
  }
}
