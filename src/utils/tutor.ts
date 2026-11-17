import type {
  TutorAccess,
  TutorChapterOption,
  TutorSessionStatus,
  TutorSessionSummary,
  TutorStage,
  TutorTurnView,
} from '../api/types';

/** The four stages of a session in the order the tutor moves through them. */
export const TUTOR_STAGES: TutorStage[] = ['RECAP', 'TEACH', 'PRACTICE', 'CLOSE'];

/** Translation key for a stage's short label (the stage strip above the chat). */
export function stageLabelKey(stage: TutorStage): string {
  return `tutor.stage.${stage.toLowerCase()}`;
}

/**
 * Translation key for the plain-words explanation of why the tutor is locked. `no_entitlement`
 * (the school has not switched the beta on for this student) is the usual one; an unknown reason
 * falls back to the generic premium text.
 */
export function accessReasonKey(reason: TutorAccess['reason'] | string | null | undefined): string {
  switch (reason) {
    case 'no_entitlement':
      return 'tutor.access.noEntitlement';
    case 'no_sessions_left':
      return 'tutor.access.noSessionsLeft';
    case 'not_active':
      return 'tutor.access.notActive';
    case 'not_available':
      return 'tutor.access.notAvailable';
    default:
      return 'tutor.access.generic';
  }
}

export interface TutorSubjectGroup {
  subjectKey: string;
  subjectName: string;
  chapters: TutorChapterOption[];
}

/**
 * Chapters grouped by subject. Subjects with at least one chapter ready for the tutor come first
 * (keeping the server's order among themselves), so a student does not scroll past a whole subject
 * of "Not ready yet" to find the one they can study.
 */
export function groupChaptersBySubject(chapters: TutorChapterOption[]): TutorSubjectGroup[] {
  const groups: TutorSubjectGroup[] = [];
  for (const chapter of chapters) {
    const existing = groups.find((g) => g.subjectKey === chapter.subjectKey);
    if (existing) existing.chapters.push(chapter);
    else groups.push({ subjectKey: chapter.subjectKey, subjectName: chapter.subjectName, chapters: [chapter] });
  }
  const ready = groups.filter((g) => g.chapters.some((c) => c.ingested));
  const notReady = groups.filter((g) => !g.chapters.some((c) => c.ingested));
  return [...ready, ...notReady];
}

/** 0..1 mastery as a whole percentage, or null before the student has attempted anything. */
export function masteryPercent(mastery: number | null | undefined): number | null {
  if (mastery === null || mastery === undefined || Number.isNaN(mastery)) return null;
  return Math.round(Math.min(1, Math.max(0, mastery)) * 100);
}

/** The session to offer "Continue" on: the newest ACTIVE one, or null. */
export function activeSession(sessions: TutorSessionSummary[]): TutorSessionSummary | null {
  return sessions.find((s) => s.status === 'ACTIVE') ?? null;
}

/** How a session's status reads as a StatusChip. */
export function sessionStatusVariant(status: TutorSessionStatus): 'success' | 'warning' | 'neutral' | 'info' {
  switch (status) {
    case 'ACTIVE':
      return 'info';
    case 'CLOSED':
      return 'success';
    case 'ABANDONED':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** Only the turns a student should see in the chat: SYSTEM turns stay server-side bookkeeping. */
export function visibleTurns(turns: TutorTurnView[]): TutorTurnView[] {
  return turns.filter((turn) => turn.role !== 'SYSTEM');
}

/** The one turn to read aloud: the last tutor reply, if the latest visible turn is the tutor's. */
export function latestTutorTurn(turns: TutorTurnView[]): TutorTurnView | null {
  const shown = visibleTurns(turns);
  const last = shown[shown.length - 1];
  return last && last.role === 'TUTOR' ? last : null;
}

/** A session's length in minutes for a list row, from the server's number or the timestamps. */
export function sessionMinutes(session: Pick<TutorSessionSummary, 'minutes' | 'startedAt' | 'endedAt'>): number | null {
  if (typeof session.minutes === 'number') return session.minutes;
  if (!session.startedAt || !session.endedAt) return null;
  const ms = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}

/** Every question has an option picked: the quiz can be sent. */
export function quizComplete(questionIds: string[], answers: Record<string, string | undefined>): boolean {
  return questionIds.length > 0 && questionIds.every((id) => !!answers[id]);
}

// Phase 2: knowledge map, diagnostic and hint ladder (workspace specs/ai-tutor-adaptive/spec.md)

/** Every diagnostic item has an option picked: the quick check can be submitted. */
export function diagnosticComplete(itemIds: string[], answers: Record<string, string | undefined>): boolean {
  return itemIds.length > 0 && itemIds.every((id) => !!answers[id]);
}

/** The highest rung of the hint ladder: the answer itself. Levels 1..3 are hints. */
export const HINT_ANSWER_LEVEL = 4;

/**
 * Translation key for the small tag on a tutor turn that carries a hint level: "Hint 1 of 4" for
 * levels 1 to 3, "Answer" for level 4, nothing for level 0 or a turn from an older server.
 */
export function hintTagKey(hintLevel: number | null | undefined): 'tutor.hint.level' | 'tutor.hint.answer' | null {
  if (typeof hintLevel !== 'number' || hintLevel < 1) return null;
  return hintLevel >= HINT_ANSWER_LEVEL ? 'tutor.hint.answer' : 'tutor.hint.level';
}

/**
 * True when the student has been wrong twice in a row on the same knowledge point: the last two
 * tutor turns both carry a hint (level 1 to 3) on the same point, and the latest turn is still a
 * hint, not the answer. That is when "Just tell me" is offered.
 */
export function stuckOnPoint(turns: TutorTurnView[]): boolean {
  const tutorTurns = visibleTurns(turns).filter((turn) => turn.role === 'TUTOR');
  if (tutorTurns.length < 2) return false;
  const last = tutorTurns[tutorTurns.length - 1];
  const previous = tutorTurns[tutorTurns.length - 2];
  const isHint = (turn: TutorTurnView) =>
    typeof turn.hintLevel === 'number' && turn.hintLevel >= 1 && turn.hintLevel < HINT_ANSWER_LEVEL;
  return isHint(last) && isHint(previous) && (last.knowledgePointId ?? null) === (previous.knowledgePointId ?? null);
}

/** The literal message "Just tell me" sends; the server lets the ladder jump to the answer on it. */
export const JUST_TELL_ME_MESSAGE = 'Please just tell me the answer.';
