import type {
  AnnouncementAudiences,
  AnnouncementAudienceSection,
  AnnouncementScope,
  CreateAnnouncementRequest,
  UserRole,
} from '../api/types';

/**
 * The decisions behind "Post a notice" (AnnouncementComposeScreen, and its entry on School Events).
 * The server is the authority: GET /api/v1/chat/announcements/audiences says where the caller may
 * post, and POST /api/v1/chat/announcements checks it again. These helpers only offer what the
 * server offered, and send what it will accept.
 */

/** The server's limits (CreateAnnouncementRequest: title @Size(max = 200), body @Size(max = 4000)). */
export const NOTICE_LIMITS = { title: 200, body: 4000 } as const;

/** Who a notice goes to, fully chosen: the scope plus the section or class it needs. */
export type NoticeAudience =
  | { kind: 'SCHOOL' }
  | { kind: 'CLASS'; sectionId: string }
  | { kind: 'GRADE'; className: string };

/** The confirmation text for an audience: an `announcementCompose.*` key. */
export type NoticeConfirmKey = 'confirmSchool' | 'confirmSection' | 'confirmGrade';

/**
 * Whether the app should ask the server where this session may post. The audiences endpoint is
 * ADMIN and TEACHER only, so nobody else is offered the composer (or sent there for a 403).
 */
export function mayPostNotices(role: UserRole | null | undefined): boolean {
  return role === 'ADMIN' || role === 'TEACHER';
}

/**
 * The audience kinds on offer, always in the order SCHOOL, CLASS, GRADE, and only those the server
 * allows: the whole school for an admin, sections and classes when there are any.
 */
export function audienceKinds(audiences: AnnouncementAudiences): AnnouncementScope[] {
  const kinds: AnnouncementScope[] = [];
  if (audiences.school) kinds.push('SCHOOL');
  if (audiences.sections.length > 0) kinds.push('CLASS');
  if (audiences.grades.length > 0) kinds.push('GRADE');
  return kinds;
}

/**
 * Whether there is anywhere to post: the server's `canPost`, and at least one audience to offer
 * (so an odd answer never shows a form with nothing to pick). Shows the entry and the form.
 */
export function hasAudience(audiences: AnnouncementAudiences | null | undefined): boolean {
  return !!audiences && audiences.canPost && audienceKinds(audiences).length > 0;
}

/**
 * Whether School Events shows "Post a notice": only for an admin or teacher (anyone else isn't asked,
 * so nobody gets a 403), and only when the server's audiences answer has somewhere to post. Any
 * failure - an older server's 404 on the audiences endpoint, no network - hides the button and
 * resolves false; it never rejects, so it can't reach the events list.
 */
export async function noticeEntryVisible(
  role: UserRole | null | undefined,
  loadAudiences: () => Promise<AnnouncementAudiences>
): Promise<boolean> {
  if (!mayPostNotices(role)) return false;
  try {
    return hasAudience(await loadAudiences());
  } catch {
    return false;
  }
}

const collator = new Intl.Collator(undefined, { numeric: true });

/**
 * Sections for display: by class, then section, with numbers in order ("Grade 2" before
 * "Grade 10"), and the latest academic year first when the same section appears for two years.
 */
export function sortSections(sections: readonly AnnouncementAudienceSection[]): AnnouncementAudienceSection[] {
  return [...sections].sort(
    (a, b) =>
      collator.compare(a.className, b.className) ||
      collator.compare(a.section, b.section) ||
      collator.compare(b.academicYear, a.academicYear)
  );
}

/** Class names for display, numbers in order ("Grade 2" before "Grade 10"), each once. */
export function sortGrades(grades: readonly string[]): string[] {
  return [...new Set(grades)].sort((a, b) => collator.compare(a, b));
}

/** Whether the sections span more than one academic year, so their labels need the year. */
export function showYears(sections: readonly AnnouncementAudienceSection[]): boolean {
  return new Set(sections.map((s) => s.academicYear)).size > 1;
}

/** "Grade 8 - A", or "Grade 8 - A (2026-27)" when the list spans several years (see showYears). */
export function sectionLabel(section: AnnouncementAudienceSection, showYear: boolean): string {
  const label = `${section.className} - ${section.section}`;
  return showYear ? `${label} (${section.academicYear})` : label;
}

/** The title as the server stores it: one line, every run of spaces and line breaks made one space. */
export function normaliseTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim();
}

/** The body as the server stores it: line breaks kept but made \n, and no blank space at either end. */
export function normaliseBody(body: string): string {
  return body.replace(/\r\n?/g, '\n').trim();
}

/** The audience from the picks so far, or null while the CLASS section or GRADE class isn't picked. */
export function chosenAudience(
  kind: AnnouncementScope | null,
  sectionId: string | null,
  className: string | null
): NoticeAudience | null {
  switch (kind) {
    case 'SCHOOL':
      return { kind: 'SCHOOL' };
    case 'CLASS':
      return sectionId ? { kind: 'CLASS', sectionId } : null;
    case 'GRADE':
      return className ? { kind: 'GRADE', className } : null;
    default:
      return null;
  }
}

function isComplete(audience: NoticeAudience | null): audience is NoticeAudience {
  if (!audience) return false;
  if (audience.kind === 'CLASS') return audience.sectionId.length > 0;
  if (audience.kind === 'GRADE') return audience.className.length > 0;
  return true;
}

/**
 * Whether Send is on: an audience fully chosen, and a title and a message that are 1 to the
 * server's limit long once normalised the way the server does it.
 */
export function canSend(audience: NoticeAudience | null, title: string, body: string): boolean {
  if (!isComplete(audience)) return false;
  const titleLength = normaliseTitle(title).length;
  const bodyLength = normaliseBody(body).length;
  return titleLength >= 1 && titleLength <= NOTICE_LIMITS.title && bodyLength >= 1 && bodyLength <= NOTICE_LIMITS.body;
}

/** The POST body: the scope with only its own target field, and the normalised title and body. */
export function toCreateRequest(audience: NoticeAudience, title: string, body: string): CreateAnnouncementRequest {
  const request: CreateAnnouncementRequest = {
    scope: audience.kind,
    title: normaliseTitle(title),
    body: normaliseBody(body),
  };
  if (audience.kind === 'CLASS') request.sectionId = audience.sectionId;
  if (audience.kind === 'GRADE') request.className = audience.className;
  return request;
}

/** Which confirmation names who gets notified (it matches the server's recipients for the scope). */
export function confirmKey(audience: NoticeAudience): NoticeConfirmKey {
  switch (audience.kind) {
    case 'SCHOOL':
      return 'confirmSchool';
    case 'CLASS':
      return 'confirmSection';
    case 'GRADE':
      return 'confirmGrade';
  }
}

/** How a send ended: `busy` when another send was still in flight, so nothing was sent. */
export type NoticeSendResult<T> = { status: 'sent'; value: T } | { status: 'failed'; error: unknown } | { status: 'busy' };

/**
 * Send's double-tap guard: at most one confirmation open and one request in flight, whatever the
 * taps. Both flags change synchronously, before React re-renders the button as disabled.
 *
 * - `openConfirm()` is the tap on Send: true (and the confirmation now counts as open) only when no
 *   confirmation is open and nothing is being sent.
 * - Every way the confirmation closes calls `closeConfirm()`: Cancel, the dialog's Send, and on
 *   Android Back or a tap outside it (`onDismiss`). It is safe to call twice.
 * - `send(request)` runs `request` unless one is in flight (then `busy`, and nothing is sent). The
 *   flag is cleared before the result is returned, after success too, so the screen's own
 *   navigation back passes useHoldWhileSaving, which reads `inFlight`.
 */
export interface NoticeSendGuard {
  readonly inFlight: { current: boolean };
  openConfirm(): boolean;
  closeConfirm(): void;
  send<T>(request: () => Promise<T>): Promise<NoticeSendResult<T>>;
}

export function createNoticeSendGuard(): NoticeSendGuard {
  const inFlight = { current: false };
  let confirmOpen = false;
  return {
    inFlight,
    openConfirm() {
      if (confirmOpen || inFlight.current) return false;
      confirmOpen = true;
      return true;
    },
    closeConfirm() {
      confirmOpen = false;
    },
    async send<T>(request: () => Promise<T>): Promise<NoticeSendResult<T>> {
      if (inFlight.current) return { status: 'busy' };
      inFlight.current = true;
      try {
        const value = await request();
        inFlight.current = false;
        return { status: 'sent', value };
      } catch (error) {
        inFlight.current = false;
        return { status: 'failed', error };
      }
    },
  };
}
