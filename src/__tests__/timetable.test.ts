import type { Period, Timetable, TimetableClash, TimetableSlot } from '../api/timetable';
import { ApiError } from '../api/client';
import { clashesFromError, notAssignedFromError, overrideExistsFromError, timetableRuleFromError } from '../api/timetable';
import {
  addDaysIso,
  addMinutes,
  cellEditMode,
  cellsToSlotRequests,
  clearCellAction,
  currentPeriodNumber,
  dateViewSlots,
  defaultDay,
  describeClash,
  isIsoDate,
  isoDayOfWeek,
  isPastIso,
  nextPeriodRow,
  normalizeTime,
  periodRowsToRequest,
  pickedDate,
  slotBadge,
  slotKey,
  slotsByPeriodForDate,
  slotsToCells,
  todayIso,
  validatePeriodRows,
} from '../utils/timetable';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn(() => Promise.resolve()) }));

const periods: Period[] = [
  { periodNumber: 1, startTime: '08:00', endTime: '08:40', breakPeriod: false, label: null },
  { periodNumber: 2, startTime: '08:40', endTime: '09:10', breakPeriod: true, label: 'Recess' },
  { periodNumber: 3, startTime: '09:10', endTime: '09:50', breakPeriod: false, label: null },
];

const slot = (day: TimetableSlot['dayOfWeek'], periodNumber: number): TimetableSlot => ({
  dayOfWeek: day,
  periodNumber,
  subjectId: 's1',
  subjectName: 'Maths',
  subjectCode: 'M',
  teacherId: 't1',
  teacherName: 'T',
  sectionId: 'sec',
  className: 'Grade 5',
  section: 'A',
});

describe('cellsToSlotRequests', () => {
  it('round-trips saved slots', () => {
    const cells = slotsToCells([slot('MONDAY', 1), slot('TUESDAY', 3)]);
    expect(cellsToSlotRequests(cells, ['MONDAY', 'TUESDAY'], periods)).toEqual([
      { dayOfWeek: 'MONDAY', periodNumber: 1, subjectId: 's1', teacherId: 't1', roomId: null },
      { dayOfWeek: 'TUESDAY', periodNumber: 3, subjectId: 's1', teacherId: 't1', roomId: null },
    ]);
  });

  it('keeps each cell room and always sends roomId, so the server never keeps a room the admin cleared', () => {
    const cells = slotsToCells([
      { ...slot('MONDAY', 1), roomId: 'lab-1', roomName: 'Lab 1' },
      // A slot from a server that predates rooms has no roomId at all.
      slot('MONDAY', 3),
    ]);
    expect(cells[slotKey('MONDAY', 1)]).toEqual({ subjectId: 's1', teacherId: 't1', roomId: 'lab-1' });
    expect(cells[slotKey('MONDAY', 3)]).toEqual({ subjectId: 's1', teacherId: 't1', roomId: null });

    const requests = cellsToSlotRequests(
      { ...cells, [slotKey('TUESDAY', 1)]: { subjectId: 's2', teacherId: 't2' } },
      ['MONDAY', 'TUESDAY'],
      periods
    );
    expect(requests).toEqual([
      { dayOfWeek: 'MONDAY', periodNumber: 1, subjectId: 's1', teacherId: 't1', roomId: 'lab-1' },
      { dayOfWeek: 'MONDAY', periodNumber: 3, subjectId: 's1', teacherId: 't1', roomId: null },
      { dayOfWeek: 'TUESDAY', periodNumber: 1, subjectId: 's2', teacherId: 't2', roomId: null },
    ]);
    expect(requests.every((r) => 'roomId' in r)).toBe(true);
  });

  it('drops cells on switched-off days and break periods', () => {
    const cells = {
      [slotKey('SATURDAY', 1)]: { subjectId: 's1', teacherId: 't1' },
      [slotKey('MONDAY', 2)]: { subjectId: 's1', teacherId: 't1' },
    };
    expect(cellsToSlotRequests(cells, ['MONDAY'], periods)).toEqual([]);
  });
});

describe('defaultDay', () => {
  it('picks today when it is a school day', () => {
    expect(defaultDay(['MONDAY', 'TUESDAY'], new Date(2026, 8, 29))).toBe('TUESDAY');
  });
  it('falls back to the first day on a weekend', () => {
    expect(defaultDay(['MONDAY', 'TUESDAY'], new Date(2026, 9, 4))).toBe('MONDAY');
  });
});

describe('time helpers', () => {
  it('normalizes times', () => {
    expect(normalizeTime('8:30')).toBe('08:30');
    expect(normalizeTime('13:05')).toBe('13:05');
    expect(normalizeTime('25:00')).toBeNull();
    expect(normalizeTime('8.30')).toBeNull();
  });
  it('adds minutes without passing midnight', () => {
    expect(addMinutes('08:40', 40)).toBe('09:20');
    expect(addMinutes('23:50', 40)).toBe('23:59');
  });
  it('suggests the next period after the last one', () => {
    expect(nextPeriodRow([{ startTime: '08:00', endTime: '08:40', breakPeriod: false, label: '' }])).toEqual({
      startTime: '08:40',
      endTime: '09:20',
      breakPeriod: false,
      label: '',
    });
  });
});

describe('validatePeriodRows', () => {
  const row = (startTime: string, endTime: string) => ({ startTime, endTime, breakPeriod: false, label: '' });
  it('accepts back-to-back periods', () => {
    expect(validatePeriodRows([row('08:00', '08:40'), row('08:40', '09:20')])).toBeNull();
  });
  it('rejects empty, bad times, reversed and overlapping periods', () => {
    expect(validatePeriodRows([])).toEqual({ code: 'empty' });
    expect(validatePeriodRows([row('8', '09:00')])).toEqual({ code: 'badTime', periodNumber: 1 });
    expect(validatePeriodRows([row('09:00', '08:00')])).toEqual({ code: 'endBeforeStart', periodNumber: 1 });
    expect(validatePeriodRows([row('08:00', '08:45'), row('08:40', '09:20')])).toEqual({
      code: 'overlap',
      periodNumber: 2,
      previous: 1,
    });
  });
  it('numbers periods by position and trims labels', () => {
    expect(periodRowsToRequest([{ startTime: '8:00', endTime: '08:40', breakPeriod: true, label: ' Lunch ' }])).toEqual([
      { periodNumber: 1, startTime: '08:00', endTime: '08:40', breakPeriod: true, label: 'Lunch' },
    ]);
  });
});

describe('clashesFromError', () => {
  it('extracts clashes from a TIMETABLE_CLASH error', () => {
    const clash = { dayOfWeek: 'MONDAY', periodNumber: 1, teacherId: 't', teacherName: 'T', conflictingSectionId: 'x', conflictingSectionLabel: '5 - B' };
    expect(clashesFromError(new ApiError('clash', 409, 'TIMETABLE_CLASH', [clash]))).toEqual([clash]);
  });
  it('keeps the newer fields: dated clashes, rooms, absent substitutes and the conflicting change', () => {
    const room = {
      dayOfWeek: 'WEDNESDAY',
      periodNumber: 3,
      teacherId: 't',
      teacherName: 'Ravi',
      conflictingSectionId: 'x',
      conflictingSectionLabel: 'Grade 6 - B',
      date: '2026-10-14',
      reason: 'ROOM_BUSY',
      roomId: 'r1',
      roomName: 'Lab 1',
      conflictingOverrideId: 'o1',
    };
    const absent = {
      ...room,
      reason: 'TEACHER_ABSENT',
      conflictingSectionId: null,
      conflictingSectionLabel: null,
      roomId: null,
      roomName: null,
      conflictingOverrideId: null,
    };
    expect(clashesFromError(new ApiError('clash', 409, 'TIMETABLE_CLASH', [room, absent]))).toEqual([room, absent]);
  });
  it('gives an empty list when the database caught a clash the checks missed', () => {
    expect(clashesFromError(new ApiError('The timetable changed while saving.', 409, 'TIMETABLE_CLASH'))).toEqual([]);
  });
  it('returns null for other errors', () => {
    expect(clashesFromError(new ApiError('bad', 400))).toBeNull();
    expect(clashesFromError(new Error('x'))).toBeNull();
  });
});

describe('notAssignedFromError / overrideExistsFromError / timetableRuleFromError', () => {
  const notAssigned = new ApiError('Not assigned', 409, 'TIMETABLE_NOT_ASSIGNED', {
    sectionId: 'sec',
    subjectId: 'sub',
    subjectName: 'Maths',
    teacherId: 't2',
    teacherName: 'Ravi Kumar',
  });

  it('reads the subject and teacher of an unassigned pair', () => {
    expect(notAssignedFromError(notAssigned)).toEqual({
      sectionId: 'sec',
      subjectId: 'sub',
      subjectName: 'Maths',
      teacherId: 't2',
      teacherName: 'Ravi Kumar',
    });
    // Missing data still counts as the code (the app then falls back to the names it picked).
    expect(notAssignedFromError(new ApiError('x', 409, 'TIMETABLE_NOT_ASSIGNED'))).toEqual({
      sectionId: '',
      subjectId: '',
      subjectName: '',
      teacherId: '',
      teacherName: '',
    });
    expect(notAssignedFromError(new ApiError('x', 409, 'TIMETABLE_CLASH', []))).toBeNull();
    expect(notAssignedFromError(new Error('x'))).toBeNull();
  });

  it('reads the existing change of a duplicate', () => {
    expect(overrideExistsFromError(new ApiError('x', 409, 'TIMETABLE_OVERRIDE_EXISTS', { overrideId: 'o1' }))).toEqual({
      overrideId: 'o1',
    });
    expect(overrideExistsFromError(new ApiError('x', 409, 'TIMETABLE_OVERRIDE_EXISTS'))).toEqual({ overrideId: null });
    expect(overrideExistsFromError(notAssigned)).toBeNull();
  });

  it('reads which rule a TIMETABLE_INVALID broke', () => {
    expect(
      timetableRuleFromError(new ApiError('x', 400, 'TIMETABLE_INVALID', { rule: 'HOLIDAY', holidayName: 'Diwali' }))
    ).toBe('HOLIDAY');
    expect(timetableRuleFromError(new ApiError('x', 400, 'TIMETABLE_INVALID'))).toBeNull();
    expect(timetableRuleFromError(new ApiError('x', 400))).toBeNull();
  });
});

const dated = (overrides: Partial<TimetableSlot>): TimetableSlot => ({ ...slot('WEDNESDAY', 3), date: '2026-10-14', ...overrides });

describe('slotBadge', () => {
  const substitute = dated({
    overrideId: 'o1',
    overrideKind: 'SUBSTITUTE',
    teacherId: 'sub',
    teacherName: 'Ravi',
    originalTeacherId: 'orig',
    originalTeacherName: 'Sunita',
  });

  it('gives no badge to a regular period', () => {
    expect(slotBadge(slot('MONDAY', 1), 't1')).toBeNull();
    expect(slotBadge(dated({ overrideKind: null }))).toBeNull();
  });

  it('marks cancelled and extra periods for everyone', () => {
    expect(slotBadge(dated({ overrideKind: 'CANCELLED' }), 't1')).toEqual({ kind: 'cancelled' });
    expect(slotBadge(dated({ overrideKind: 'EXTRA' }))).toEqual({ kind: 'extra' });
  });

  it('tells the original teacher who takes their period', () => {
    expect(slotBadge(substitute, 'orig')).toEqual({ kind: 'takenBy', teacher: 'Ravi' });
  });

  it('tells the substitute whose class they cover', () => {
    expect(slotBadge(substitute, 'sub')).toEqual({ kind: 'covering', teacher: 'Sunita' });
  });

  it('tells students, parents and anyone else that a substitute is in', () => {
    expect(slotBadge(substitute)).toEqual({ kind: 'substitute', teacher: 'Sunita' });
    expect(slotBadge(substitute, null)).toEqual({ kind: 'substitute', teacher: 'Sunita' });
    expect(slotBadge(substitute, 'someone-else')).toEqual({ kind: 'substitute', teacher: 'Sunita' });
  });

  it('does not address an admin looking at a teacher timetable as "you"', () => {
    expect(slotBadge(substitute, 'sub', { thirdPerson: true })).toEqual({ kind: 'substitute', teacher: 'Sunita' });
    expect(slotBadge(substitute, 'orig', { thirdPerson: true })).toEqual({ kind: 'takenBy', teacher: 'Ravi' });
  });
});

describe('slotsByPeriodForDate', () => {
  it('puts the viewer own teaching first when they have two slots in one period', () => {
    const takenFromMe = dated({ sectionId: '5A', overrideKind: 'SUBSTITUTE', teacherId: 'sub', originalTeacherId: 'me' });
    const myCover = dated({ sectionId: '6B', overrideKind: 'SUBSTITUTE', teacherId: 'me', originalTeacherId: 'other' });
    const second = dated({ sectionId: '5A', periodNumber: 4, teacherId: 'me' });
    const byPeriod = slotsByPeriodForDate([takenFromMe, second, myCover], 'me');
    expect(byPeriod.get(3)).toEqual([myCover, takenFromMe]);
    expect(byPeriod.get(4)).toEqual([second]);
    expect(byPeriod.get(1)).toBeUndefined();
  });

  it('does not count a cancelled period as one the viewer teaches', () => {
    const cancelled = dated({ sectionId: '5A', overrideKind: 'CANCELLED', teacherId: 'me', originalTeacherId: 'me' });
    const cover = dated({ sectionId: '6B', overrideKind: 'EXTRA', teacherId: 'me' });
    expect(slotsByPeriodForDate([cancelled, cover], 'me').get(3)).toEqual([cover, cancelled]);
  });

  it('keeps the server order without a viewer', () => {
    const a = dated({ sectionId: 'a' });
    const b = dated({ sectionId: 'b' });
    expect(slotsByPeriodForDate([a, b]).get(3)).toEqual([a, b]);
  });
});

describe('dateViewSlots', () => {
  const week: Timetable = {
    scope: 'SECTION',
    sectionId: 'sec',
    sectionLabel: 'Grade 5 - A',
    teacherId: null,
    teacherName: null,
    academicYear: '2026-27',
    saturdayEnabled: false,
    days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    periods,
    slots: [slot('MONDAY', 1), slot('WEDNESDAY', 3)],
  };

  it('uses a date view slots as they are', () => {
    const day = { ...week, date: '2026-10-12', schoolDay: true, slots: [dated({})] };
    expect(dateViewSlots(day, '2026-10-12')).toEqual([dated({})]);
  });

  it('keeps only that weekday when an older server sent the week instead', () => {
    // 14 Oct 2026 is a Wednesday; 18 Oct a Sunday.
    expect(dateViewSlots(week, '2026-10-14')).toEqual([slot('WEDNESDAY', 3)]);
    expect(dateViewSlots(week, '2026-10-18')).toEqual([]);
  });
});

describe('cellEditMode', () => {
  it('saves each period straight away unless a whole-week draft is open', () => {
    expect(cellEditMode(false)).toBe('immediate');
    expect(cellEditMode(true)).toBe('draft');
  });
});

describe('clearCellAction', () => {
  it('asks before deleting a saved period straight away', () => {
    expect(clearCellAction('immediate', true)).toBe('confirm');
  });

  it('just closes the sheet when the period is already free', () => {
    expect(clearCellAction('immediate', false)).toBe('close');
  });

  it('edits the draft without asking, since nothing is lost until "Save timetable"', () => {
    expect(clearCellAction('draft', true)).toBe('draft');
    expect(clearCellAction('draft', false)).toBe('draft');
  });
});

describe('pickedDate', () => {
  const date = new Date(2026, 9, 14);

  it('takes the date when one was set', () => {
    expect(pickedDate({ type: 'set' }, date)).toBe(date);
  });

  it('ignores a cancelled picker, which on Android still reports the date it opened on', () => {
    expect(pickedDate({ type: 'dismissed' }, date)).toBeNull();
    expect(pickedDate({ type: 'neutralButtonPressed' }, date)).toBeNull();
  });

  it('ignores a set event with no date', () => {
    expect(pickedDate({ type: 'set' }, undefined)).toBeNull();
  });
});

describe('describeClash', () => {
  const base: TimetableClash = {
    dayOfWeek: 'MONDAY',
    periodNumber: 2,
    teacherId: 't',
    teacherName: 'Ravi',
    conflictingSectionId: 'x',
    conflictingSectionLabel: 'Grade 6 - B',
  };

  it('words a weekly teacher clash the old way, also when an older server sends no reason', () => {
    expect(describeClash(base)).toEqual({
      key: 'timetable.editor.clashLine',
      day: 'MONDAY',
      n: 2,
      teacher: 'Ravi',
      section: 'Grade 6 - B',
      room: '',
      date: null,
    });
    expect(describeClash({ ...base, reason: 'TEACHER_BUSY' }).key).toBe('timetable.editor.clashLine');
  });

  it('words room clashes and absent substitutes, with the date of a one-day clash', () => {
    expect(describeClash({ ...base, reason: 'ROOM_BUSY', roomName: 'Lab 1' })).toMatchObject({
      key: 'timetable.editor.clashRoom',
      room: 'Lab 1',
      date: null,
    });
    expect(
      describeClash({
        ...base,
        reason: 'TEACHER_ABSENT',
        conflictingSectionId: null,
        conflictingSectionLabel: null,
        date: '2026-10-14',
      })
    ).toMatchObject({ key: 'timetable.editor.clashAbsent', section: '', date: '2026-10-14' });
  });
});

describe('date helpers', () => {
  it('reads today from the phone calendar, not UTC', () => {
    // 00:30 on 14 Oct in India is still 13 Oct in UTC; toISOString would say the 13th.
    expect(todayIso(new Date(2026, 9, 14, 0, 30))).toBe('2026-10-14');
    expect(todayIso(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14');
    expect(todayIso(new Date(2026, 0, 5, 9, 0))).toBe('2026-01-05');
  });

  it('adds days across months, years and leap days', () => {
    expect(addDaysIso('2026-10-14', 1)).toBe('2026-10-15');
    expect(addDaysIso('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysIso('2026-10-14', 0)).toBe('2026-10-14');
  });

  it('knows past days from today and later', () => {
    expect(isPastIso('2026-10-13', '2026-10-14')).toBe(true);
    expect(isPastIso('2026-10-14', '2026-10-14')).toBe(false);
    expect(isPastIso('2026-10-15', '2026-10-14')).toBe(false);
    expect(isPastIso('2025-12-31', '2026-01-01')).toBe(true);
  });

  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isIsoDate('2026-10-14')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('14-10-2026')).toBe(false);
    expect(isIsoDate('2026-10-14T00:00:00')).toBe(false);
    expect(isIsoDate(20261014)).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it('gives the weekday of a date', () => {
    expect(isoDayOfWeek('2026-10-14')).toBe('WEDNESDAY');
    expect(isoDayOfWeek('2026-10-18')).toBe('SUNDAY');
  });
});

describe('currentPeriodNumber', () => {
  const periods = [
    { periodNumber: 1, startTime: '08:00', endTime: '08:40', breakPeriod: false, label: null },
    { periodNumber: 2, startTime: '08:40', endTime: '09:20', breakPeriod: false, label: null },
  ];
  const at = (h: number, m: number) => new Date(2026, 9, 19, h, m);
  it('finds the period by the clock, start inclusive and end exclusive', () => {
    expect(currentPeriodNumber(periods, at(8, 0))).toBe(1);
    expect(currentPeriodNumber(periods, at(8, 39))).toBe(1);
    expect(currentPeriodNumber(periods, at(8, 40))).toBe(2);
    expect(currentPeriodNumber(periods, at(9, 20))).toBeNull();
    expect(currentPeriodNumber(periods, at(7, 59))).toBeNull();
  });
});
