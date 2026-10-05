/** An open session older than this is treated as a forgotten check-out. */
export const MAX_SHIFT_HOURS = 16;
export const MAX_SHIFT_MS = MAX_SHIFT_HOURS * 3_600_000;
/** An admin correction may not stretch a single session beyond this. */
export const MAX_ADJUSTED_SPAN_MS = 24 * 3_600_000;
/** Clock skew allowed when an admin enters a time. */
export const FUTURE_TOLERANCE_MS = 60_000;

export const PHOTO_MAX_BYTES = 1_048_576;
export const PHOTO_FIELD = 'photo';
export const PHOTO_CONTENT_TYPE = 'image/jpeg';

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
