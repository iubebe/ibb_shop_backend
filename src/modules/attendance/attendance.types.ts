import type { FaceCheckStatus, UserRole } from '../../database/enums.js';

export type PhotoKind = 'check-in' | 'check-out';
export type RecordStatus = 'open' | 'completed' | 'incomplete';

export interface AttendanceRecordView {
  id: string;
  userId: string;
  userName: string | null;
  checkInAt: Date;
  checkOutAt: Date | null;
  /** Worked minutes; null until the session is completed. */
  minutes: number | null;
  status: RecordStatus;
  checkInFaceStatus: FaceCheckStatus;
  checkOutFaceStatus: FaceCheckStatus;
  hasCheckOutPhoto: boolean;
  /** An admin corrected the times. */
  adjusted: boolean;
}

export interface MonthSummary {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  /** Calendar days (shop timezone) with at least one session. */
  days: number;
  sessions: number;
  /** Only completed sessions count towards worked time. */
  minutes: number;
  /** Open sessions older than the max shift (forgotten check-out). */
  incomplete: number;
}

export interface MyAttendanceView {
  timezone: string;
  state: 'idle' | 'checked_in';
  open: { id: string; checkInAt: Date } | null;
  today: { minutes: number; sessions: number };
  month: { month: string } & Pick<
    MonthSummary,
    'days' | 'sessions' | 'minutes' | 'incomplete'
  >;
  recent: AttendanceRecordView[];
}

export interface FaceCheckJob {
  recordId: string;
  userId: string;
  kind: PhotoKind;
  photoKey: string;
  enqueuedAt: string;
}
