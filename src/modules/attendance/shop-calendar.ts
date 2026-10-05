import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** Month/day boundaries in the shop timezone (`SHOP_TIMEZONE`). */
@Injectable()
export class ShopCalendar {
  readonly timezone: string;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.timezone = config.get<string>('SHOP_TIMEZONE') || DEFAULT_TIMEZONE;
  }

  async currentMonth(): Promise<string> {
    const rows = await this.dataSource.query<{ month: string }[]>(
      `SELECT to_char(now() AT TIME ZONE $1, 'YYYY-MM') AS month`,
      [this.timezone],
    );
    return rows[0].month;
  }

  async startOfToday(): Promise<Date> {
    const rows = await this.dataSource.query<{ start: Date }[]>(
      `SELECT date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1 AS start`,
      [this.timezone],
    );
    return rows[0].start;
  }

  /** [start, end) of a `YYYY-MM` month as timestamptz values. */
  async monthRange(month: string): Promise<{ start: Date; end: Date }> {
    const rows = await this.dataSource.query<{ start: Date; end: Date }[]>(
      `SELECT ($1::date)::timestamp AT TIME ZONE $2 AS start,
              (($1::date + interval '1 month')::timestamp) AT TIME ZONE $2 AS "end"`,
      [`${month}-01`, this.timezone],
    );
    return rows[0];
  }

  /** `YYYY-MM-DD HH:mm:ss` in the shop timezone. */
  format(date: Date): string {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: this.timezone,
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(date);
  }
}
