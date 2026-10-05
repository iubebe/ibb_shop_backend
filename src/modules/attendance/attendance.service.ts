import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import {
  And,
  DataSource,
  EntityManager,
  IsNull,
  LessThan,
  MoreThan,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import type { AuthUser } from '../../auth/auth.types.js';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity.js';
import { User } from '../../database/entities/user.entity.js';
import { S3Service } from '../../s3/s3.service.js';
import {
  FUTURE_TOLERANCE_MS,
  MAX_ADJUSTED_SPAN_MS,
  MAX_SHIFT_MS,
  PHOTO_CONTENT_TYPE,
} from './attendance.constants.js';
import { AttendanceReportService } from './attendance-report.service.js';
import type {
  AttendanceRecordView,
  MyAttendanceView,
  PhotoKind,
  RecordStatus,
} from './attendance.types.js';
import { FaceQueueService } from './face-queue.service.js';
import { assertJpeg } from './photo.js';
import { ShopCalendar } from './shop-calendar.js';

const RECENT_LIMIT = 10;

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly records: Repository<AttendanceRecord>,
    private readonly dataSource: DataSource,
    private readonly s3: S3Service,
    private readonly faceQueue: FaceQueueService,
    private readonly calendar: ShopCalendar,
    private readonly report: AttendanceReportService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AttendanceService.name);
  }

  async checkIn(
    user: AuthUser,
    photo: Buffer | undefined,
  ): Promise<AttendanceRecordView> {
    assertJpeg(photo);
    if (await this.findOpen(this.records.manager, user.id)) {
      throw new ConflictException('You are already checked in');
    }

    const id = randomUUID();
    const key = photoKey(user, id, 'in');
    await this.s3.upload(key, photo, { contentType: PHOTO_CONTENT_TYPE });
    try {
      const record = await this.dataSource.transaction(async (m) => {
        await this.lockUser(m, user.id);
        if (await this.findOpen(m, user.id)) {
          throw new ConflictException('You are already checked in');
        }
        return m.save(
          m.create(AttendanceRecord, {
            id,
            branchId: user.branchId,
            userId: user.id,
            checkInAt: new Date(),
            checkInPhotoKey: key,
          }),
        );
      });
      await this.faceQueue.enqueue({
        recordId: id,
        userId: user.id,
        kind: 'check-in',
        photoKey: key,
      });
      return this.view(record);
    } catch (err) {
      await this.discardPhoto(key);
      throw err;
    }
  }

  async checkOut(
    user: AuthUser,
    photo: Buffer | undefined,
  ): Promise<AttendanceRecordView> {
    assertJpeg(photo);
    const open = await this.findOpen(this.records.manager, user.id);
    if (!open) throw new ConflictException('You are not checked in');

    const key = photoKey(user, open.id, 'out');
    await this.s3.upload(key, photo, { contentType: PHOTO_CONTENT_TYPE });
    try {
      const record = await this.dataSource.transaction(async (m) => {
        await this.lockUser(m, user.id);
        const current = await this.findOpen(m, user.id);
        if (current?.id !== open.id) {
          throw new ConflictException('You are not checked in');
        }
        current.checkOutAt = new Date();
        current.checkOutPhotoKey = key;
        return m.save(current);
      });
      await this.faceQueue.enqueue({
        recordId: record.id,
        userId: user.id,
        kind: 'check-out',
        photoKey: key,
      });
      return this.view(record);
    } catch (err) {
      await this.discardPhoto(key);
      throw err;
    }
  }

  /** Everything the staff check-in screen needs in one call. */
  async me(user: AuthUser): Promise<MyAttendanceView> {
    const [month, startOfToday] = await Promise.all([
      this.calendar.currentMonth(),
      this.calendar.startOfToday(),
    ]);
    const [open, recent, summaries] = await Promise.all([
      this.findOpen(this.records.manager, user.id),
      this.records.find({
        where: { userId: user.id },
        order: { checkInAt: 'DESC' },
        take: RECENT_LIMIT,
      }),
      this.report.summaries(user.branchId, month, user.id),
    ]);
    const mine = summaries[0];
    const today = recent
      .filter((r) => r.checkInAt >= startOfToday)
      .map((r) => this.view(r));
    return {
      timezone: this.calendar.timezone,
      state: open ? 'checked_in' : 'idle',
      open: open ? { id: open.id, checkInAt: open.checkInAt } : null,
      today: {
        minutes: today.reduce((sum, r) => sum + (r.minutes ?? 0), 0),
        sessions: today.length,
      },
      month: {
        month,
        days: mine?.days ?? 0,
        sessions: mine?.sessions ?? 0,
        minutes: mine?.minutes ?? 0,
        incomplete: mine?.incomplete ?? 0,
      },
      recent: recent.map((r) => this.view(r)),
    };
  }

  async list(
    branchId: string,
    month: string,
    userId?: string,
  ): Promise<AttendanceRecordView[]> {
    const { start, end } = await this.calendar.monthRange(month);
    const rows = await this.records.find({
      where: {
        branchId,
        ...(userId ? { userId } : {}),
        checkInAt: And(MoreThanOrEqual(start), LessThan(end)),
      },
      relations: { user: true },
      order: { checkInAt: 'DESC' },
    });
    return rows.map((r) => this.view(r));
  }

  /** Admin correction, e.g. to close a forgotten check-out. */
  async adjust(
    branchId: string,
    actorId: string,
    id: string,
    patch: { checkInAt?: Date; checkOutAt?: Date },
  ): Promise<AttendanceRecordView> {
    const record = await this.records.findOne({
      where: { id, branchId },
      relations: { user: true },
    });
    if (!record) throw new NotFoundException('Attendance record not found');

    const checkInAt = patch.checkInAt ?? record.checkInAt;
    const checkOutAt = patch.checkOutAt ?? record.checkOutAt;
    const latest = Date.now() + FUTURE_TOLERANCE_MS;
    if (checkInAt.getTime() > latest || (checkOutAt?.getTime() ?? 0) > latest) {
      throw new BadRequestException('Times cannot be in the future');
    }
    if (checkOutAt) {
      const span = checkOutAt.getTime() - checkInAt.getTime();
      if (span <= 0) {
        throw new BadRequestException('Check-out must be after check-in');
      }
      if (span > MAX_ADJUSTED_SPAN_MS) {
        throw new BadRequestException('A session cannot exceed 24 hours');
      }
    }

    record.checkInAt = checkInAt;
    record.checkOutAt = checkOutAt;
    record.adjustedAt = new Date();
    record.adjustedByUserId = actorId;
    return this.view(await this.records.save(record));
  }

  async photo(
    branchId: string,
    id: string,
    kind: PhotoKind,
  ): Promise<StreamableFile> {
    const record = await this.records.findOneBy({ id, branchId });
    const key =
      kind === 'check-in' ? record?.checkInPhotoKey : record?.checkOutPhotoKey;
    if (!key) throw new NotFoundException('Photo not found');
    const file = await this.s3.download(key);
    return new StreamableFile(file.body, { type: PHOTO_CONTENT_TYPE });
  }

  /** The user's current session; ones past the max shift count as forgotten. */
  private findOpen(manager: EntityManager, userId: string) {
    return manager.findOne(AttendanceRecord, {
      where: {
        userId,
        checkOutAt: IsNull(),
        checkInAt: MoreThan(new Date(Date.now() - MAX_SHIFT_MS)),
      },
      order: { checkInAt: 'DESC' },
    });
  }

  /** Serializes a user's check-in/out so two taps can't both succeed. */
  private lockUser(manager: EntityManager, userId: string) {
    return manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private async discardPhoto(key: string): Promise<void> {
    try {
      await this.s3.delete(key);
    } catch (err) {
      this.logger.warn({ err, key }, 'Could not remove orphaned photo');
    }
  }

  private view(r: AttendanceRecord): AttendanceRecordView {
    return {
      id: r.id,
      userId: r.userId,
      userName: r.user?.name ?? null,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
      minutes: r.checkOutAt
        ? Math.round((r.checkOutAt.getTime() - r.checkInAt.getTime()) / 60_000)
        : null,
      status: statusOf(r),
      checkInFaceStatus: r.checkInFaceStatus,
      checkOutFaceStatus: r.checkOutFaceStatus,
      hasCheckOutPhoto: r.checkOutPhotoKey !== null,
      adjusted: r.adjustedAt !== null,
    };
  }
}

function statusOf(r: AttendanceRecord): RecordStatus {
  if (r.checkOutAt) return 'completed';
  return Date.now() - r.checkInAt.getTime() > MAX_SHIFT_MS
    ? 'incomplete'
    : 'open';
}

function photoKey(user: AuthUser, recordId: string, suffix: 'in' | 'out') {
  return `attendance/${user.branchId}/${user.id}/${recordId}-${suffix}.jpg`;
}
