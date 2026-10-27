import type { TutorReport, TutorStage, TutorTurnView } from '../api/types';
import { colors } from '../theme/colors';

/**
 * Pure helpers behind the parent's AI Tutor report and the transcript screen (workspace
 * specs/ai-tutor-preview/contract.md, "Parent report" and "Sessions").
 */

/** A mastery value (0 to 1, or null before any attempt) put into one of four bands. */
export type MasteryLevel = 'none' | 'low' | 'mid' | 'high';

export function masteryLevel(mastery: number | null | undefined): MasteryLevel {
  if (mastery === null || mastery === undefined || Number.isNaN(mastery)) return 'none';
  if (mastery < 0.4) return 'low';
  if (mastery < 0.7) return 'mid';
  return 'high';
}

/** The dot / bar colour of a mastery band: red, marigold, green, grey before any attempt. */
export function masteryColor(level: MasteryLevel): string {
  switch (level) {
    case 'low':
      return colors.error;
    case 'mid':
      return colors.marigold;
    case 'high':
      return colors.success;
    default:
      return colors.border;
  }
}

/** Translation key (under tutorParent.mastery) for a band's label. */
export function masteryLabelKey(level: MasteryLevel): string {
  return `tutorParent.mastery.${level}`;
}

/** Mastery as a whole-number percentage, clamped to 0..100; null stays null. */
export function masteryPercent(mastery: number | null | undefined): number | null {
  if (mastery === null || mastery === undefined || Number.isNaN(mastery)) return null;
  return Math.round(Math.min(1, Math.max(0, mastery)) * 100);
}

export interface QuizBar {
  weekStart: string;
  score: number;
  total: number;
  /** "4/5" */
  label: string;
  /** 0..1 of the tallest bar height; a zero score still shows a sliver so the week is visible. */
  height: number;
}

/**
 * The quiz trend as bars, oldest first, each scaled by its fraction of the quiz total so a 4/5 and an
 * 8/10 are the same height. Keeps the last `maxWeeks` weeks when the server sends more.
 */
export function quizBars(trend: TutorReport['quizTrend'], maxWeeks = 12): QuizBar[] {
  const recent = trend.slice(Math.max(0, trend.length - maxWeeks));
  return recent.map((week) => {
    const fraction = week.total > 0 ? Math.min(1, Math.max(0, week.score / week.total)) : 0;
    return {
      weekStart: week.weekStart,
      score: week.score,
      total: week.total,
      label: `${week.score}/${week.total}`,
      height: Math.max(0.06, fraction),
    };
  });
}

export type AccessSummary =
  | { kind: 'active'; sessionsRemaining: number | null; expiresAt: string | null }
  | { kind: 'inactive'; reason: string | null };

/** What the access line says: active with what is left, or not active (whatever the reason). */
export function accessSummary(access: TutorReport['access']): AccessSummary {
  if (access.allowed) return { kind: 'active', sessionsRemaining: access.sessionsRemaining, expiresAt: access.expiresAt };
  return { kind: 'inactive', reason: access.reason };
}

/** True when the student has never had a tutor session: the report shows its empty state. */
export function isEmptyReport(report: TutorReport): boolean {
  return report.total.sessions === 0 && report.recentSessions.length === 0 && report.chapters.every((c) => c.sessions === 0);
}

/** "26 Oct" or "26 Oct 2025" when not this year; the raw string when it is not a date. */
export function shortDate(iso: string | null | undefined, locale?: string, now: Date = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const sameYear = date.getFullYear() === now.getFullYear();
  try {
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
  } catch {
    return date.toDateString();
  }
}

/** "26 Oct, 4:30 pm" for a session header. */
export function dateTime(iso: string | null | undefined, locale?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return `${date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}`;
  } catch {
    return date.toString();
  }
}

export type TranscriptItem = { kind: 'stage'; stage: TutorStage; key: string } | { kind: 'turn'; turn: TutorTurnView; key: string };

/**
 * The turns in order with a stage label inserted wherever the stage changes (and before the first
 * staged turn), so the transcript reads "Recap ... Teach ... Practice ... Close". Turns without a
 * stage never produce a label and never reset the running stage.
 */
export function transcriptItems(turns: readonly TutorTurnView[]): TranscriptItem[] {
  const sorted = [...turns].sort((a, b) => a.seq - b.seq);
  const items: TranscriptItem[] = [];
  let current: TutorStage | null = null;
  for (const turn of sorted) {
    if (turn.stage && turn.stage !== current) {
      current = turn.stage;
      items.push({ kind: 'stage', stage: turn.stage, key: `stage-${turn.seq}` });
    }
    items.push({ kind: 'turn', turn, key: turn.id });
  }
  return items;
}
