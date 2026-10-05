import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../database/enums.js';
import {
  PHOTO_FIELD,
  PHOTO_MAX_BYTES,
  XLSX_CONTENT_TYPE,
} from './attendance.constants.js';
import { AttendanceReportService } from './attendance-report.service.js';
import { AttendanceService } from './attendance.service.js';
import {
  ListAttendanceQuery,
  MonthQuery,
  PhotoParams,
  UpdateAttendanceDto,
} from './dto/attendance.dto.js';

/** The slice of a multer memory-storage file we use. */
interface UploadedPhoto {
  buffer: Buffer;
}

const photoUpload = FileInterceptor(PHOTO_FIELD, {
  limits: { fileSize: PHOTO_MAX_BYTES, files: 1 },
});

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly report: AttendanceReportService,
  ) {}

  // --- staff / cashier -----------------------------------------------------

  @Roles(UserRole.STAFF, UserRole.CASHIER)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.attendance.me(user);
  }

  @Roles(UserRole.STAFF, UserRole.CASHIER)
  @Post('check-in')
  @UseInterceptors(photoUpload)
  checkIn(
    @CurrentUser() user: AuthUser,
    @UploadedFile() photo?: UploadedPhoto,
  ) {
    return this.attendance.checkIn(user, photo?.buffer);
  }

  @Roles(UserRole.STAFF, UserRole.CASHIER)
  @Post('check-out')
  @HttpCode(200)
  @UseInterceptors(photoUpload)
  checkOut(
    @CurrentUser() user: AuthUser,
    @UploadedFile() photo?: UploadedPhoto,
  ) {
    return this.attendance.checkOut(user, photo?.buffer);
  }

  // --- admin ---------------------------------------------------------------

  @Roles(UserRole.ADMIN)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListAttendanceQuery) {
    return this.attendance.list(user.branchId, query.month, query.userId);
  }

  @Roles(UserRole.ADMIN)
  @Get('report')
  async summary(@CurrentUser() user: AuthUser, @Query() query: MonthQuery) {
    return {
      month: query.month,
      rows: await this.report.summaries(user.branchId, query.month),
    };
  }

  @Roles(UserRole.ADMIN)
  @Get('report/export')
  @Header('Content-Type', XLSX_CONTENT_TYPE)
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: MonthQuery,
  ): Promise<StreamableFile> {
    const file = await this.report.exportXlsx(user.branchId, query.month);
    return new StreamableFile(file, {
      type: XLSX_CONTENT_TYPE,
      disposition: `attachment; filename="attendance-${query.month}.xlsx"`,
    });
  }

  @Roles(UserRole.ADMIN)
  @Get(':id/photo/:kind')
  @Header('Cache-Control', 'private, max-age=3600')
  photo(@CurrentUser() user: AuthUser, @Param() params: PhotoParams) {
    return this.attendance.photo(user.branchId, params.id, params.kind);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  adjust(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendance.adjust(user.branchId, user.id, id, dto);
  }
}
