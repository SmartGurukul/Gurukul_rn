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
