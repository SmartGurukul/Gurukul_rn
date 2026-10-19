import type { DayOfWeek, Period, Timetable, TimetableClash, TimetableSlot, TimetableSlotRequest } from '../api/timetable';

const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export function slotKey(day: DayOfWeek, periodNumber: number): string {
  return `${day}|${periodNumber}`;
}

/** The subject+teacher (and room) chosen for one cell of the editor grid. */
export interface CellAssignment {
  subjectId: string;
  teacherId: string;
  /** Null or left out: no room. */
  roomId?: string | null;
}

export function slotsToCells(slots: TimetableSlot[]): Record<string, CellAssignment> {
  const cells: Record<string, CellAssignment> = {};
  for (const s of slots) {
    cells[slotKey(s.dayOfWeek, s.periodNumber)] = { subjectId: s.subjectId, teacherId: s.teacherId, roomId: s.roomId ?? null };
  }
  return cells;
}

/**
 * The editor's cells as a save payload. Cells on days or periods that are no longer schedulable
 * (Saturday switched off, a period that's now a break) are dropped rather than sent to be rejected.
 * `roomId` is always sent (null for no room): the server keeps a cell's room only when the field is
 * left out, which is what older app builds do.
 */
export function cellsToSlotRequests(
  cells: Record<string, CellAssignment>,
  days: DayOfWeek[],
  periods: Period[]
): TimetableSlotRequest[] {
  const teachable = new Set(periods.filter((p) => !p.breakPeriod).map((p) => p.periodNumber));
  const result: TimetableSlotRequest[] = [];
  for (const day of days) {
    for (const periodNumber of teachable) {
      const cell = cells[slotKey(day, periodNumber)];
      if (cell) {
        result.push({ dayOfWeek: day, periodNumber, subjectId: cell.subjectId, teacherId: cell.teacherId, roomId: cell.roomId ?? null });
      }
    }
  }
  return result;
}

export function slotsForDay(slots: TimetableSlot[], day: DayOfWeek): Map<number, TimetableSlot> {
  const byPeriod = new Map<number, TimetableSlot>();
  for (const s of slots) {
    if (s.dayOfWeek === day) byPeriod.set(s.periodNumber, s);
  }
  return byPeriod;
}

/** Today's tab if today is a school day, otherwise the first school day. */
export function defaultDay(days: DayOfWeek[], now: Date = new Date()): DayOfWeek {
  const today = JS_DAY_TO_DAY_OF_WEEK[now.getDay()];
  return days.includes(today) ? today : (days[0] ?? 'MONDAY');
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Accepts "8:30" or "08:30"; returns the canonical "HH:mm", or null if it isn't a time. */
export function normalizeTime(input: string): string | null {
  const trimmed = input.trim();
  const padded = /^\d:\d\d$/.test(trimmed) ? `0${trimmed}` : trimmed;
  return TIME_PATTERN.test(padded) ? padded : null;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function addMinutes(time: string, minutes: number): string {
  const total = Math.min(toMinutes(time) + minutes, 23 * 60 + 59);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** An editable row of the bell-schedule screen - numbered by position. */
export interface PeriodRow {
  startTime: string;
  endTime: string;
  breakPeriod: boolean;
  label: string;
}

export type PeriodRowError =
  | { code: 'empty' }
  | { code: 'tooMany'; max: number }
  | { code: 'badTime'; periodNumber: number }
  | { code: 'endBeforeStart'; periodNumber: number }
  | { code: 'overlap'; periodNumber: number; previous: number };

export const MAX_PERIODS = 15;

/**
 * Mirrors the server's checks so the admin sees the problem before saving: at least one period,
 * valid times, each period ends after it starts, and each starts no earlier than the previous ends.
 * Returns null when valid.
 */
export function validatePeriodRows(rows: PeriodRow[]): PeriodRowError | null {
  if (rows.length === 0) return { code: 'empty' };
  if (rows.length > MAX_PERIODS) return { code: 'tooMany', max: MAX_PERIODS };
  let previousEnd: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    const periodNumber = i + 1;
    const start = normalizeTime(rows[i].startTime);
    const end = normalizeTime(rows[i].endTime);
    if (!start || !end) return { code: 'badTime', periodNumber };
    if (toMinutes(end) <= toMinutes(start)) return { code: 'endBeforeStart', periodNumber };
    if (previousEnd !== null && toMinutes(start) < previousEnd) {
      return { code: 'overlap', periodNumber, previous: periodNumber - 1 };
    }
    previousEnd = toMinutes(end);
  }
  return null;
}

export function periodRowsToRequest(rows: PeriodRow[]): Period[] {
  return rows.map((r, i) => ({
    periodNumber: i + 1,
    startTime: normalizeTime(r.startTime) ?? r.startTime,
    endTime: normalizeTime(r.endTime) ?? r.endTime,
    breakPeriod: r.breakPeriod,
    label: r.label.trim() ? r.label.trim() : null,
  }));
}

/** A sensible next row: starts when the last one ends, 40 minutes long. */
export function nextPeriodRow(rows: PeriodRow[]): PeriodRow {
  const last = rows[rows.length - 1];
  const start = last ? (normalizeTime(last.endTime) ?? '08:00') : '08:00';
  return { startTime: start, endTime: addMinutes(start, 40), breakPeriod: false, label: '' };
}

// ---- Date views (one day's periods, with substitutions and cancellations applied) ----

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatLocalIso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * Today as YYYY-MM-DD, from the phone's own calendar day (the same way DatePickerField's toIsoDate
 * does) - not toISOString(), which is UTC and would say "yesterday" before 05:30 in India.
 */
export function todayIso(now: Date = new Date()): string {
  return formatLocalIso(now);
}

/** The date `n` days after (or before, for negative `n`) a YYYY-MM-DD date. */
export function addDaysIso(iso: string, n: number): string {
  const match = ISO_DATE.exec(iso);
  if (!match) return iso;
  return formatLocalIso(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + n));
}

/** True when `iso` is before `today` (both YYYY-MM-DD). Past days can be read but not changed. */
export function isPastIso(iso: string, today: string): boolean {
  return iso < today;
}

/** The weekday of a YYYY-MM-DD date. */
export function isoDayOfWeek(iso: string): DayOfWeek {
  const match = ISO_DATE.exec(iso);
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(NaN);
  return JS_DAY_TO_DAY_OF_WEEK[date.getDay()] ?? 'MONDAY';
}

/** "Wed, 14 Oct" in the app's language. */
export function formatIsoDate(iso: string, locale?: string): string {
  const match = ISO_DATE.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * The periods of a date view. A server from before date views ignores `date` and sends the whole
 * week (with no `date` on the timetable), so then only that weekday's periods are kept - otherwise
 * Monday's periods would show on every date.
 */
export function dateViewSlots(timetable: Timetable, date: string): TimetableSlot[] {
  if (timetable.date) return timetable.slots;
  const day = isoDayOfWeek(date);
  return timetable.slots.filter((s) => s.dayOfWeek === day);
}

/** The chip shown on a period that was changed for the day. */
export type SlotBadge =
  | { kind: 'cancelled' }
  | { kind: 'extra' }
  /** `teacher`: the substitute's name ("Taken by Ravi"). */
  | { kind: 'takenBy'; teacher: string }
  /** `teacher`: the original teacher's name ("You're covering for Sunita"). */
  | { kind: 'covering'; teacher: string }
  /** `teacher`: the original teacher's name ("Substitute for Sunita"). */
  | { kind: 'substitute'; teacher: string };

/**
 * Which badge a period gets for this viewer: null for a regular period. On a substitution the
 * original teacher sees who takes it, the substitute sees whose class they cover, and everyone
 * else (students, parents, an admin) sees that a substitute is in. `thirdPerson`: an admin looking
 * at a teacher's timetable, where "You're covering" would be addressed to the wrong person.
 */
export function slotBadge(
  slot: TimetableSlot,
  viewerEmployeeId?: string | null,
  options: { thirdPerson?: boolean } = {}
): SlotBadge | null {
  switch (slot.overrideKind) {
    case 'CANCELLED':
      return { kind: 'cancelled' };
    case 'EXTRA':
      return { kind: 'extra' };
    case 'SUBSTITUTE': {
      const original = slot.originalTeacherName ?? '';
      const viewer = viewerEmployeeId ?? null;
      if (viewer && slot.teacherId === viewer) {
        return options.thirdPerson ? { kind: 'substitute', teacher: original } : { kind: 'covering', teacher: original };
      }
      if (viewer && slot.originalTeacherId === viewer) return { kind: 'takenBy', teacher: slot.teacherName };
      return { kind: 'substitute', teacher: original };
    }
    default:
      return null;
  }
}

/**
 * A date view's periods grouped by period number. A teacher can have two in one period - one taken
 * from them and one they cover elsewhere - so the one they actually teach comes first.
 */
export function slotsByPeriodForDate(slots: TimetableSlot[], viewerEmployeeId?: string | null): Map<number, TimetableSlot[]> {
  const teaches = (s: TimetableSlot) => !!viewerEmployeeId && s.teacherId === viewerEmployeeId && s.overrideKind !== 'CANCELLED';
  const byPeriod = new Map<number, TimetableSlot[]>();
  for (const s of slots) {
    const list = byPeriod.get(s.periodNumber);
    if (list) list.push(s);
    else byPeriod.set(s.periodNumber, [s]);
  }
  for (const [period, list] of byPeriod) {
    byPeriod.set(period, [...list.filter(teaches), ...list.filter((s) => !teaches(s))]);
  }
  return byPeriod;
}

/**
 * How a tap on a period saves in the editor: straight away, one period at a time, unless there are
 * unsaved whole-week edits (after "Copy this day to every day") - then taps change that draft and
 * "Save timetable" sends the week.
 */
export function cellEditMode(dirty: boolean): 'immediate' | 'draft' {
  return dirty ? 'draft' : 'immediate';
}

/**
 * What "Leave free" does. In a draft it just edits the draft (nothing is lost until "Save
 * timetable"). Otherwise it deletes the saved period on the server straight away, so it asks
 * first; on a period that is already free there is nothing to clear and the sheet just closes.
 */
export function clearCellAction(mode: 'immediate' | 'draft', hasSavedPeriod: boolean): 'draft' | 'confirm' | 'close' {
  if (mode === 'draft') return 'draft';
  return hasSavedPeriod ? 'confirm' : 'close';
}

/**
 * The date a date picker's change event chose, or null when it was cancelled. On Android a
 * dismissed picker still calls onChange, with the value it opened on, so the date alone can't
 * tell a pick from a cancel.
 */
export function pickedDate(event: { type: string }, date: Date | undefined): Date | null {
  return event.type === 'set' && date ? date : null;
}

/** How to word one refused period: which line, its values, and the date for a one-day clash. */
export interface ClashDescription {
  key: 'timetable.editor.clashLine' | 'timetable.editor.clashRoom' | 'timetable.editor.clashAbsent';
  day: DayOfWeek;
  n: number;
  teacher: string;
  section: string;
  room: string;
  /** Set when the clash is on one date rather than in the weekly timetable. */
  date: string | null;
}

export function describeClash(clash: TimetableClash): ClashDescription {
  const key =
    clash.reason === 'ROOM_BUSY'
      ? 'timetable.editor.clashRoom'
      : clash.reason === 'TEACHER_ABSENT'
        ? 'timetable.editor.clashAbsent'
        : 'timetable.editor.clashLine';
  return {
    key,
    day: clash.dayOfWeek,
    n: clash.periodNumber,
    teacher: clash.teacherName ?? '',
    section: clash.conflictingSectionLabel ?? '',
    room: clash.roomName ?? '',
    date: clash.date ?? null,
  };
}

/**
 * The period that `now` falls in (start inclusive, end exclusive), by the "HH:mm" times of the
 * bell schedule; null outside every period. Used to mark "Now" on a date view of today.
 */
export function currentPeriodNumber(periods: readonly Period[], now: Date = new Date()): number | null {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  const hit = periods.find((p) => minutes >= toMinutes(p.startTime) && minutes < toMinutes(p.endTime));
  return hit ? hit.periodNumber : null;
}
