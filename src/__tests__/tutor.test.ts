import type { TutorChapterOption, TutorSessionSummary, TutorTurnView } from '../api/types';
import {
  accessReasonKey,
  activeSession,
  diagnosticComplete,
  groupChaptersBySubject,
  hintTagKey,
  latestTutorTurn,
  masteryPercent,
  quizComplete,
  sessionMinutes,
  sessionStatusVariant,
  stageLabelKey,
  stuckOnPoint,
  TUTOR_STAGES,
  visibleTurns,
} from '../utils/tutor';

const chapter = (over: Partial<TutorChapterOption>): TutorChapterOption => ({
  chapterId: 'jesc1-c01',
  bookCode: 'jesc1',
  bookTitle: 'Science',
  subjectKey: 'science',
  subjectName: 'Science',
  chapterNumber: 1,
  title: 'Chemical Reactions and Equations',
  topicCount: 2,
  ingested: true,
  mastery: null,
  lastSessionAt: null,
  ...over,
});

const turn = (over: Partial<TutorTurnView>): TutorTurnView => ({
  id: 't1',
  seq: 1,
  role: 'TUTOR',
  stage: 'RECAP',
  content: 'Hello',
  citations: [],
  topicId: null,
  createdAt: '2026-10-26T10:00:00Z',
  latencyMs: null,
  ...over,
});

const session = (over: Partial<TutorSessionSummary>): TutorSessionSummary => ({
  id: 's1',
  chapterId: 'jesc1-c01',
  chapterTitle: 'Chemical Reactions and Equations',
  bookTitle: 'Science',
  mode: 'TEXT',
  status: 'CLOSED',
  startedAt: '2026-10-26T10:00:00Z',
  endedAt: '2026-10-26T10:12:30Z',
  turnCount: 8,
  minutes: null,
  summary: null,
  parentNote: null,
  ...over,
});

describe('stageLabelKey', () => {
  it('maps every stage to a tutor.stage key in the tutor order', () => {
    expect(TUTOR_STAGES).toEqual(['RECAP', 'TEACH', 'PRACTICE', 'CLOSE']);
    expect(TUTOR_STAGES.map(stageLabelKey)).toEqual([
      'tutor.stage.recap',
      'tutor.stage.teach',
      'tutor.stage.practice',
      'tutor.stage.close',
    ]);
  });
});

describe('accessReasonKey', () => {
  it('words each reason, and falls back for an unknown or missing one', () => {
    expect(accessReasonKey('no_entitlement')).toBe('tutor.access.noEntitlement');
    expect(accessReasonKey('no_sessions_left')).toBe('tutor.access.noSessionsLeft');
    expect(accessReasonKey('not_active')).toBe('tutor.access.notActive');
    expect(accessReasonKey(null)).toBe('tutor.access.generic');
    expect(accessReasonKey('something_new')).toBe('tutor.access.generic');
  });
});

describe('groupChaptersBySubject', () => {
  it('keeps the server order and groups chapters of one subject together', () => {
    const groups = groupChaptersBySubject([
      chapter({ chapterId: 'sci-1', chapterNumber: 1 }),
      chapter({ chapterId: 'sci-2', chapterNumber: 2 }),
      chapter({ chapterId: 'math-1', subjectKey: 'maths', subjectName: 'Mathematics', bookTitle: 'Mathematics' }),
    ]);
    expect(groups.map((g) => [g.subjectName, g.chapters.map((c) => c.chapterId)])).toEqual([
      ['Science', ['sci-1', 'sci-2']],
      ['Mathematics', ['math-1']],
    ]);
  });
  it('is empty for no chapters', () => {
    expect(groupChaptersBySubject([])).toEqual([]);
  });
  it('lists subjects with a ready chapter before subjects with none', () => {
    const groups = groupChaptersBySubject([
      chapter({ chapterId: 'eng-1', subjectKey: 'english', subjectName: 'English', ingested: false }),
      chapter({ chapterId: 'eng-2', subjectKey: 'english', subjectName: 'English', ingested: false }),
      chapter({ chapterId: 'sci-1', ingested: true }),
      chapter({ chapterId: 'math-1', subjectKey: 'maths', subjectName: 'Mathematics', ingested: false }),
    ]);
    expect(groups.map((g) => g.subjectName)).toEqual(['Science', 'English', 'Mathematics']);
  });
});

describe('masteryPercent', () => {
  it('rounds a 0..1 mastery to a whole percentage and clamps', () => {
    expect(masteryPercent(0.42)).toBe(42);
    expect(masteryPercent(0.999)).toBe(100);
    expect(masteryPercent(1.4)).toBe(100);
    expect(masteryPercent(-0.2)).toBe(0);
  });
  it('is null before any attempt', () => {
    expect(masteryPercent(null)).toBeNull();
    expect(masteryPercent(undefined)).toBeNull();
    expect(masteryPercent(Number.NaN)).toBeNull();
  });
});

describe('activeSession', () => {
  it('finds the newest ACTIVE session, or null', () => {
    const active = session({ id: 'a', status: 'ACTIVE' });
    expect(activeSession([session({ id: 'c' }), active, session({ id: 'b', status: 'ACTIVE' })])).toBe(active);
    expect(activeSession([session({ id: 'c' })])).toBeNull();
    expect(activeSession([])).toBeNull();
  });
});

describe('sessionStatusVariant', () => {
  it('colours each status', () => {
    expect(sessionStatusVariant('ACTIVE')).toBe('info');
    expect(sessionStatusVariant('CLOSED')).toBe('success');
    expect(sessionStatusVariant('ABANDONED')).toBe('warning');
    expect(sessionStatusVariant('PLANNED')).toBe('neutral');
  });
});

describe('turns', () => {
  it('hides SYSTEM turns and reads only a trailing tutor reply aloud', () => {
    const turns = [
      turn({ id: 'sys', role: 'SYSTEM' }),
      turn({ id: 'tutor1' }),
      turn({ id: 'me', role: 'STUDENT' }),
      turn({ id: 'tutor2' }),
    ];
    expect(visibleTurns(turns).map((t) => t.id)).toEqual(['tutor1', 'me', 'tutor2']);
    expect(latestTutorTurn(turns)?.id).toBe('tutor2');
    expect(latestTutorTurn([turn({ id: 'tutor1' }), turn({ id: 'me', role: 'STUDENT' })])).toBeNull();
    expect(latestTutorTurn([])).toBeNull();
  });
});

describe('sessionMinutes', () => {
  it('prefers the server figure and otherwise rounds the timestamps', () => {
    expect(sessionMinutes(session({ minutes: 7 }))).toBe(7);
    expect(sessionMinutes(session({}))).toBe(13);
    expect(sessionMinutes(session({ endedAt: null }))).toBeNull();
    expect(sessionMinutes(session({ startedAt: null, endedAt: null }))).toBeNull();
  });
});

describe('quizComplete', () => {
  it('needs an option for every question', () => {
    expect(quizComplete(['q1', 'q2'], { q1: 'a' })).toBe(false);
    expect(quizComplete(['q1', 'q2'], { q1: 'a', q2: 'b' })).toBe(true);
    expect(quizComplete([], {})).toBe(false);
  });
});

describe('Phase 2 helpers: diagnostic and hint ladder', () => {
  const tutor = (id: string, over: Partial<TutorTurnView>): TutorTurnView => ({
    id,
    seq: 1,
    role: 'TUTOR',
    stage: 'TEACH',
    content: id,
    citations: [],
    topicId: null,
    createdAt: '2026-11-16T10:00:00Z',
    latencyMs: null,
    ...over,
  });

  it('diagnosticComplete needs every item answered', () => {
    expect(diagnosticComplete([], {})).toBe(false);
    expect(diagnosticComplete(['a', 'b'], { a: 'A' })).toBe(false);
    expect(diagnosticComplete(['a', 'b'], { a: 'A', b: 'C' })).toBe(true);
  });

  it('hintTagKey: nothing for level 0 or an older server, a hint for 1..3, the answer for 4', () => {
    expect(hintTagKey(undefined)).toBeNull();
    expect(hintTagKey(null)).toBeNull();
    expect(hintTagKey(0)).toBeNull();
    expect(hintTagKey(1)).toBe('tutor.hint.level');
    expect(hintTagKey(3)).toBe('tutor.hint.level');
    expect(hintTagKey(4)).toBe('tutor.hint.answer');
  });

  it('stuckOnPoint: two consecutive hints on the same point, not after the answer or across points', () => {
    const student = tutor('s', { role: 'STUDENT' });
    expect(stuckOnPoint([])).toBe(false);
    expect(stuckOnPoint([tutor('a', { hintLevel: 1, knowledgePointId: 'k1' })])).toBe(false);
    expect(stuckOnPoint([tutor('a', { hintLevel: 1, knowledgePointId: 'k1' }), student, tutor('b', { hintLevel: 2, knowledgePointId: 'k1' })])).toBe(true);
    // A SYSTEM turn in between does not break the run.
    expect(
      stuckOnPoint([tutor('a', { hintLevel: 1, knowledgePointId: 'k1' }), tutor('sys', { role: 'SYSTEM' }), tutor('b', { hintLevel: 1, knowledgePointId: 'k1' })]),
    ).toBe(true);
    expect(stuckOnPoint([tutor('a', { hintLevel: 1, knowledgePointId: 'k1' }), tutor('b', { hintLevel: 1, knowledgePointId: 'k2' })])).toBe(false);
    expect(stuckOnPoint([tutor('a', { hintLevel: 2, knowledgePointId: 'k1' }), tutor('b', { hintLevel: 4, knowledgePointId: 'k1' })])).toBe(false);
    expect(stuckOnPoint([tutor('a', { hintLevel: 1, knowledgePointId: 'k1' }), tutor('b', { hintLevel: 0, knowledgePointId: 'k1' })])).toBe(false);
    // Older servers send no hint level at all.
    expect(stuckOnPoint([tutor('a', {}), tutor('b', {})])).toBe(false);
  });
});
