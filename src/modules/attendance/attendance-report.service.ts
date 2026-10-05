import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { And, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity.js';
import type { UserRole } from '../../database/enums.js';
import { MAX_SHIFT_HOURS } from './attendance.constants.js';
import type { MonthSummary } from './attendance.types.js';
import { ShopCalendar } from './shop-calendar.js';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Quản trị',
  staff: 'Nhân viên',
  cashier: 'Thu ngân',
};

const SUMMARY_SQL = `
  SELECT u.id AS "userId", u.name, u.email, u.role, u."isActive",
    COUNT(DISTINCT (a."checkInAt" AT TIME ZONE $4)::date)::int AS days,
    COUNT(a.id)::int AS sessions,
    COALESCE(SUM(EXTRACT(EPOCH FROM (a."checkOutAt" - a."checkInAt")) / 60)
      FILTER (WHERE a."checkOutAt" IS NOT NULL), 0)::int AS minutes,
    COUNT(a.id) FILTER (
      WHERE a."checkOutAt" IS NULL
        AND a."checkInAt" < now() - make_interval(hours => $5)
    )::int AS incomplete
  FROM users u
  LEFT JOIN attendance_records a
    ON a."userId" = u.id AND a."checkInAt" >= $2 AND a."checkInAt" < $3
  WHERE u."branchId" = $1
    AND u.role <> 'admin'
    AND ($6::uuid IS NULL OR u.id = $6)
    AND (u."isActive" OR a.id IS NOT NULL)
  GROUP BY u.id
  ORDER BY u.name`;

/** Monthly worked-hours figures for salary, plus the Excel export. */
@Injectable()
export class AttendanceReportService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly records: Repository<AttendanceRecord>,
    private readonly calendar: ShopCalendar,
  ) {}

  /**
   * Staff/cashier accounts with their month totals. A session belongs to the
   * month (shop timezone) of its check-in.
   */
  async summaries(
    branchId: string,
    month: string,
    userId?: string,
  ): Promise<MonthSummary[]> {
    const { start, end } = await this.calendar.monthRange(month);
    return this.records.query(SUMMARY_SQL, [
      branchId,
      start,
      end,
      this.calendar.timezone,
      MAX_SHIFT_HOURS,
      userId ?? null,
    ]);
  }

  async exportXlsx(branchId: string, month: string): Promise<Buffer> {
    const { start, end } = await this.calendar.monthRange(month);
    const [summaries, sessions] = await Promise.all([
      this.summaries(branchId, month),
      this.records.find({
        where: { branchId, checkInAt: And(MoreThanOrEqual(start), LessThan(end)) },
        relations: { user: true },
        order: { checkInAt: 'ASC' },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    const summary = workbook.addWorksheet(`Tổng hợp ${month}`);
    summary.columns = [
      { header: 'Nhân viên', key: 'name', width: 28 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Vai trò', key: 'role', width: 12 },
      { header: 'Số ngày công', key: 'days', width: 14 },
      { header: 'Số ca', key: 'sessions', width: 10 },
      { header: 'Tổng giờ', key: 'hours', width: 12, style: { numFmt: '0.00' } },
      { header: 'Ca thiếu check-out', key: 'incomplete', width: 20 },
    ];
    for (const row of summaries) {
      summary.addRow({
        ...row,
        role: ROLE_LABEL[row.role],
        hours: round2(row.minutes / 60),
      });
    }
    const totalMinutes = summaries.reduce((sum, row) => sum + row.minutes, 0);
    summary.addRow({ name: 'Tổng', hours: round2(totalMinutes / 60) });

    const detail = workbook.addWorksheet('Chi tiết');
    detail.columns = [
      { header: 'Nhân viên', key: 'name', width: 28 },
      { header: 'Check-in', key: 'in', width: 22 },
      { header: 'Check-out', key: 'out', width: 22 },
      { header: 'Giờ làm', key: 'hours', width: 12, style: { numFmt: '0.00' } },
      { header: 'Ghi chú', key: 'note', width: 28 },
    ];
    for (const s of sessions) {
      const done = s.checkOutAt !== null;
      detail.addRow({
        name: s.user.name,
        in: this.calendar.format(s.checkInAt),
        out: done ? this.calendar.format(s.checkOutAt!) : '',
        hours: done
          ? round2((s.checkOutAt!.getTime() - s.checkInAt.getTime()) / 3_600_000)
          : null,
        note: [
          done ? '' : 'Chưa check-out',
          s.adjustedAt ? 'Đã chỉnh sửa' : '',
        ]
          .filter(Boolean)
          .join(', '),
      });
    }

    for (const sheet of [summary, detail]) {
      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }
    summary.lastRow!.font = { bold: true };

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
