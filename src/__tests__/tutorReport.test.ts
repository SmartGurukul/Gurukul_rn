import type { TutorTurnView } from '../api/types';
import { colors } from '../theme/colors';
import {
  accessSummary,
  dateTime,
  isEmptyReport,
  masteryColor,
  masteryLabelKey,
  masteryLevel,
  masteryPercent,
  quizBars,
  shortDate,
  transcriptItems,
} from '../utils/tutorReport';

describe('masteryLevel / masteryColor / masteryPercent', () => {
  it('bands mastery into none, low, mid, high', () => {
    expect(masteryLevel(null)).toBe('none');
    expect(masteryLevel(undefined)).toBe('none');
    expect(masteryLevel(NaN)).toBe('none');
    expect(masteryLevel(0)).toBe('low');
    expect(masteryLevel(0.39)).toBe('low');
    expect(masteryLevel(0.4)).toBe('mid');
    expect(masteryLevel(0.69)).toBe('mid');
    expect(masteryLevel(0.7)).toBe('high');
    expect(masteryLevel(1)).toBe('high');
  });

  it('colours each band and names its label key', () => {
    expect(masteryColor('low')).toBe(colors.error);
    expect(masteryColor('mid')).toBe(colors.marigold);
    expect(masteryColor('high')).toBe(colors.success);
    expect(masteryColor('none')).toBe(colors.border);
    expect(masteryLabelKey('mid')).toBe('tutorParent.mastery.mid');
  });

  it('turns mastery into a clamped whole percentage', () => {
    expect(masteryPercent(0.426)).toBe(43);
    expect(masteryPercent(1.4)).toBe(100);
    expect(masteryPercent(-0.2)).toBe(0);
    expect(masteryPercent(null)).toBeNull();
  });
});

describe('quizBars', () => {
  it('scales each week by its own total, labels the score and keeps a sliver for zero', () => {
    const bars = quizBars([
      { weekStart: '2026-10-05', score: 4, total: 5 },
      { weekStart: '2026-10-12', score: 8, total: 10 },
      { weekStart: '2026-10-19', score: 0, total: 5 },
    ]);
    expect(bars.map((b) => b.label)).toEqual(['4/5', '8/10', '0/5']);
    expect(bars[0].height).toBeCloseTo(0.8);
    expect(bars[1].height).toBeCloseTo(0.8);
    expect(bars[2].height).toBe(0.06);
  });

  it('keeps only the most recent weeks, oldest first', () => {
    const trend = Array.from({ length: 15 }, (_, i) => ({ weekStart: `w${i}`, score: i, total: 20 }));
    const bars = quizBars(trend, 12);
    expect(bars).toHaveLength(12);
    expect(bars[0].weekStart).toBe('w3');
    expect(bars[11].weekStart).toBe('w14');
  });

  it('treats a zero total as an empty bar rather than dividing by zero', () => {
    expect(quizBars([{ weekStart: 'w', score: 0, total: 0 }])[0].height).toBe(0.06);
  });
});

describe('accessSummary', () => {
  it('reports an active grant with what is left', () => {
    expect(accessSummary({ allowed: true, reason: null, plan: 'TRIAL', sessionsRemaining: 12, expiresAt: '2027-03-31T00:00:00Z' })).toEqual({
      kind: 'active',
      sessionsRemaining: 12,
      expiresAt: '2027-03-31T00:00:00Z',
    });
  });

  it('reports no access with the reason', () => {
    expect(accessSummary({ allowed: false, reason: 'no_sessions_left', plan: 'TRIAL', sessionsRemaining: 0, expiresAt: null })).toEqual({
      kind: 'inactive',
      reason: 'no_sessions_left',
    });
  });
});

describe('isEmptyReport', () => {
  const base = { total: { sessions: 0, minutes: 0, firstSessionAt: null }, recentSessions: [], chapters: [] };
  it('is empty before any session', () => {
    expect(isEmptyReport(base as never)).toBe(true);
  });
  it('is not empty once a session exists anywhere', () => {
    expect(isEmptyReport({ ...base, total: { sessions: 1, minutes: 5, firstSessionAt: 'x' } } as never)).toBe(false);
    expect(isEmptyReport({ ...base, chapters: [{ sessions: 2 }] } as never)).toBe(false);
  });
});

describe('shortDate / dateTime', () => {
  it('shows day and month, adding the year only when it is another year', () => {
    const now = new Date(2026, 9, 26);
    expect(shortDate('2026-10-05T10:00:00Z', 'en-IN', now)).toBe('5 Oct');
    expect(shortDate('2025-03-31T00:00:00Z', 'en-IN', now)).toMatch(/31 Mar 2025/);
  });
  it('passes through blanks and non-dates', () => {
    expect(shortDate(null)).toBe('');
    expect(shortDate('soon')).toBe('soon');
    expect(dateTime(undefined)).toBe('');
  });
  it('formats a session start with its time', () => {
    expect(dateTime('2026-10-26T11:00:00Z', 'en-IN')).toMatch(/26 Oct, 4:30 pm/i);
  });
});

describe('transcriptItems', () => {
  const turn = (seq: number, role: TutorTurnView['role'], stage: TutorTurnView['stage']): TutorTurnView => ({
    id: `t${seq}`,
    seq,
    role,
    stage,
    content: `turn ${seq}`,
    citations: [],
    topicId: null,
    createdAt: '2026-10-26T10:00:00Z',
    latencyMs: null,
  });

  it('inserts a stage label where the stage changes and sorts by seq', () => {
    const items = transcriptItems([turn(3, 'TUTOR', 'TEACH'), turn(1, 'TUTOR', 'RECAP'), turn(2, 'STUDENT', 'RECAP'), turn(4, 'STUDENT', 'TEACH')]);
    expect(items.map((i) => (i.kind === 'stage' ? `[${i.stage}]` : i.turn.id))).toEqual(['[RECAP]', 't1', 't2', '[TEACH]', 't3', 't4']);
  });

  it('skips labels for turns without a stage and never repeats the running stage', () => {
    const items = transcriptItems([turn(1, 'SYSTEM', null), turn(2, 'TUTOR', 'RECAP'), turn(3, 'STUDENT', null), turn(4, 'TUTOR', 'RECAP')]);
    expect(items.map((i) => (i.kind === 'stage' ? `[${i.stage}]` : i.turn.id))).toEqual(['t1', '[RECAP]', 't2', 't3', 't4']);
  });

  it('is empty for no turns', () => {
    expect(transcriptItems([])).toEqual([]);
  });
});
