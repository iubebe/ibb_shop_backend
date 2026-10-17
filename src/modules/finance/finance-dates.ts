import { BadRequestException } from '@nestjs/common';

const MS_PER_DAY = 86_400_000;

/** Rejects anything that is not a real calendar day written `YYYY-MM-DD`. */
export function assertDay(day: string): void {
  const parsed = new Date(`${day}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== day
  ) {
    throw new BadRequestException(`${day} is not a valid date`);
  }
}

/** `[from, to)` must be valid days, ordered, and at most `maxDays` long. */
export function assertRange(from: string, to: string, maxDays: number): void {
  assertDay(from);
  assertDay(to);
  const span = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  if (span <= 0) throw new BadRequestException('`from` must be before `to`');
  if (span > maxDays * MS_PER_DAY) {
    throw new BadRequestException(`Range is limited to ${maxDays} days`);
  }
}
