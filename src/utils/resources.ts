import type { TFunction } from 'i18next';

import type { LoginResponse, ResourceBook, ResourceChapter, ResourceSubject, ResourceTopic, ResourceVideo } from '../api/types';

export type ResourceViewer = 'student' | 'teacher' | 'admin';

/** Who is looking decides whether hidden chapters show and whether the hide toggle exists. */
export function resourceViewer(session: Pick<LoginResponse, 'role' | 'ownerType'>): ResourceViewer {
  if (session.ownerType === 'STUDENT') return 'student';
  return session.role === 'ADMIN' ? 'admin' : 'teacher';
}

export const resourcesCacheKey = (schoolId: string, sectionId: string) => `resources:${schoolId}:${sectionId}`;

/** Replaced textbooks stay in the catalogue for reference and are never shown here. */
export function visibleBooks(subject: ResourceSubject): ResourceBook[] {
  return subject.books.filter((book) => book.edition !== 'legacy' && book.chapters.length > 0);
}

/**
 * The server already leaves hidden chapters out of a student's payload; filtering again here keeps
 * a cached payload honest when a chapter was hidden after it was saved.
 */
export function visibleChapters(book: ResourceBook, viewer: ResourceViewer): ResourceChapter[] {
  return viewer === 'student' ? book.chapters.filter((chapter) => !chapter.hidden) : book.chapters;
}

export function chapterHasVideo(chapter: ResourceChapter): boolean {
  return chapter.video !== null || chapter.topics.some((topic) => topic.video !== null);
}

export function subjectSummary(subject: ResourceSubject, viewer: ResourceViewer): { chapters: number; videos: number } {
  let chapters = 0;
  let videos = 0;
  for (const book of visibleBooks(subject)) {
    for (const chapter of visibleChapters(book, viewer)) {
      chapters += 1;
      if (chapterHasVideo(chapter)) videos += 1;
    }
  }
  return { chapters, videos };
}

/** The subject open when the screen first shows: the first one with something to read. */
/** Subjects a given viewer should see: students are spared subjects with no chapters at all
 * (e.g. Hindi, which has no English-medium books yet); staff keep every subject to manage it. */
export function visibleResourceSubjects(subjects: ResourceSubject[], viewer: ResourceViewer): ResourceSubject[] {
  if (viewer !== 'student') return subjects;
  return subjects.filter((subject) => subjectSummary(subject, viewer).chapters > 0);
}

export function initialExpandedSubject(subjects: ResourceSubject[], viewer: ResourceViewer): string | null {
  const first = subjects.find((subject) => subjectSummary(subject, viewer).chapters > 0) ?? subjects[0];
  return first ? first.subjectId : null;
}

export function topicLabel(topic: ResourceTopic): string {
  return topic.number ? `${topic.number}  ${topic.title}` : topic.title;
}

/** "12:05" from seconds; null when the duration is unknown, so the row shows nothing. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export type TextbookOpen = { kind: 'webview'; url: string } | { kind: 'external'; url: string } | null;

/**
 * Where a textbook PDF opens. iOS WebViews render PDFs in place; Android's cannot, so there the
 * system picks a browser or PDF app. No link, nothing to open.
 */
export function textbookOpenPlan(pdfUrl: string | null, platformOS: string): TextbookOpen {
  if (!pdfUrl) return null;
  return platformOS === 'ios' ? { kind: 'webview', url: pdfUrl } : { kind: 'external', url: pdfUrl };
}

/** A copy of the payload with one chapter's hidden flag flipped, for the optimistic toggle. */
export function withChapterHidden<T extends { subjects: ResourceSubject[] }>(data: T, syllabusChapterId: string, hidden: boolean): T {
  // Untouched books and subjects keep their identity, so only the changed branch re-renders.
  const subjects = data.subjects.map((subject) => {
    let subjectChanged = false;
    const books = subject.books.map((book) => {
      if (!book.chapters.some((chapter) => chapter.syllabusChapterId === syllabusChapterId)) return book;
      subjectChanged = true;
      return {
        ...book,
        chapters: book.chapters.map((chapter) =>
          chapter.syllabusChapterId === syllabusChapterId ? { ...chapter, hidden } : chapter
        ),
      };
    });
    return subjectChanged ? { ...subject, books } : subject;
  });
  return { ...data, subjects };
}

// ---------------------------------------------------------------------------------------------
// The journey: one step per chapter, alternating sides, the current step bright and the rest quiet.
// ---------------------------------------------------------------------------------------------

export type JourneySide = 'left' | 'right';

export interface JourneyStep {
  index: number;
  /** Which side the thumbnail sits on; the text block takes the other. */
  side: JourneySide;
  chapter: ResourceChapter;
  book: ResourceBook;
}

/** Steps alternate: the first thumbnail on the left, the next on the right, and so on. */
export const stepSide = (index: number): JourneySide => (index % 2 === 0 ? 'left' : 'right');

/** A subject's chapters in reading order (Part I, then Part II), minus legacy books and, for students, hidden chapters. */
export function journeySteps(subject: ResourceSubject, viewer: ResourceViewer): JourneyStep[] {
  const steps: JourneyStep[] = [];
  for (const book of visibleBooks(subject)) {
    for (const chapter of visibleChapters(book, viewer)) {
      steps.push({ index: steps.length, side: stepSide(steps.length), chapter, book });
    }
  }
  return steps;
}

/**
 * The one bright step: the chapter the student last opened in this subject, else the first chapter
 * with a video, else the first chapter. -1 when there are no steps.
 */
export function currentStepIndex(steps: JourneyStep[], lastOpenedChapterId: string | null): number {
  if (steps.length === 0) return -1;
  if (lastOpenedChapterId) {
    const opened = steps.findIndex((step) => step.chapter.chapterId === lastOpenedChapterId);
    if (opened >= 0) return opened;
  }
  const withVideo = steps.findIndex((step) => chapterHasVideo(step.chapter));
  return withVideo >= 0 ? withVideo : 0;
}

export type StepTone = 'current' | 'done' | 'upcoming' | 'hidden';

/** Steps before the current one read normally, steps after it a little dimmer, hidden ones dimmer still. */
export function stepTone(step: Pick<JourneyStep, 'index' | 'chapter'>, currentIndex: number): StepTone {
  if (step.chapter.hidden) return 'hidden';
  if (step.index === currentIndex) return 'current';
  return step.index < currentIndex ? 'done' : 'upcoming';
}

export const isDimmed = (tone: StepTone) => tone === 'upcoming' || tone === 'hidden';

/** Whole minutes for the eyebrow; a 30-second clip still says 1 min. */
export function durationMinutes(seconds: number | null | undefined): number | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.max(1, Math.round(seconds / 60));
}

/** "Chapter 3 • 12 min", else the topic count, else "Textbook" - what the step says above its title. */
export function eyebrowText(chapter: ResourceChapter, t: TFunction): string {
  const minutes = durationMinutes(chapter.video?.durationSec);
  const detail =
    minutes !== null
      ? t('resources.minutes', { count: minutes })
      : chapter.topics.length > 0
        ? t('resources.topicCount', { count: chapter.topics.length })
        : t('resources.textbook');
  return `${t('resources.chapterLabel', { n: chapter.number })} \u2022 ${detail}`;
}

export const lastOpenedKey = (schoolId: string, sectionId: string, subjectId: string) =>
  `resources:last:${schoolId}:${sectionId}:${subjectId}`;

/** The FontAwesome5 glyph on a placeholder thumbnail, by the catalogue's subject key. */
export function subjectIcon(curriculumSubjectKey: string | null): string {
  switch (curriculumSubjectKey) {
    case 'mathematics':
      return 'calculator';
    case 'physics':
      return 'atom';
    case 'science':
    case 'chemistry':
    case 'biology':
    case 'biotechnology':
      return 'flask';
    case 'social-science':
    case 'history':
    case 'geography':
    case 'political-science':
      return 'globe';
    case 'english':
    case 'hindi':
    case 'sanskrit':
      return 'book';
    case 'computer-science':
    case 'informatics-practices':
      return 'laptop';
    case 'accountancy':
    case 'business-studies':
    case 'economics':
      return 'chart-line';
    case 'environmental-studies':
    case 'the-world-around-us':
      return 'leaf';
    default:
      return 'book-open';
  }
}

/**
 * The dashed S-curve between two steps: from under one thumbnail (its side) to the top of the next
 * on the other side, as an SVG path over a `width` x `height` box.
 */
export function connectorPath(width: number, height: number, fromSide: JourneySide, thumb: number): string {
  const left = thumb / 2;
  const right = width - thumb / 2;
  const x0 = fromSide === 'left' ? left : right;
  const x1 = fromSide === 'left' ? right : left;
  const mid = height / 2;
  return `M ${x0} 0 C ${x0} ${mid}, ${x1} ${mid}, ${x1} ${height}`;
}

// ---------------------------------------------------------------------------------------------
// The chapter timeline: one node per video-able thing, played inline in order.
// ---------------------------------------------------------------------------------------------

export interface TimelineNode {
  /** 'overview' for the chapter-level video, else the topic id. Stable, so it can be remembered. */
  key: string;
  kind: 'overview' | 'topic';
  number: string | null;
  title: string;
  video: ResourceVideo | null;
}

/** Step 0 is the chapter overview, only when a chapter-level video exists; then every topic in order. */
export function chapterTimeline(chapter: ResourceChapter, overviewTitle: string): TimelineNode[] {
  const nodes: TimelineNode[] = [];
  if (chapter.video) nodes.push({ key: 'overview', kind: 'overview', number: null, title: overviewTitle, video: chapter.video });
  for (const topic of chapter.topics) {
    nodes.push({ key: topic.topicId, kind: 'topic', number: topic.number, title: topic.title, video: topic.video });
  }
  return nodes;
}

/** The node to start on: the remembered one if it still has a video, else the first with a video, else none (-1). */
export function initialTimelineIndex(nodes: TimelineNode[], lastKey: string | null): number {
  if (lastKey) {
    const remembered = nodes.findIndex((node) => node.key === lastKey && node.video !== null);
    if (remembered >= 0) return remembered;
  }
  return nodes.findIndex((node) => node.video !== null);
}

/**
 * Whether a play-to-end event is a real one. expo-video fires playToEnd once when the player's first
 * source replaces the empty one (duration still 0), which would skip the opening node; only an item
 * with a known duration that the playhead actually reached counts.
 */
export function reachedEnd(durationSec: number | null | undefined, currentTimeSec: number | null | undefined): boolean {
  if (durationSec == null || currentTimeSec == null) return false;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return false;
  return currentTimeSec >= durationSec - 1;
}

/** After `from` plays to the end: the next node with a video, or -1 when nothing remains. */
export function nextPlayableIndex(nodes: TimelineNode[], from: number): number {
  for (let i = from + 1; i < nodes.length; i += 1) if (nodes[i].video) return i;
  return -1;
}

export type NodeMarker = 'playing' | 'available' | 'none';

/** How the rail marks a node: filled when it is the one playing, outlined when it has a video, hollow grey otherwise. */
export function nodeMarker(node: Pick<TimelineNode, 'video'>, selected: boolean): NodeMarker {
  if (!node.video) return 'none';
  return selected ? 'playing' : 'available';
}

export function nodeLabel(node: Pick<TimelineNode, 'number' | 'title'>): string {
  return node.number ? `${node.number} ${node.title}` : node.title;
}

/** "Chapter 1 • 14 topics" above the title on the chapter page; "Textbook" when the chapter lists no topics. */
export function chapterTopicsEyebrow(chapter: Pick<ResourceChapter, 'number' | 'topics'>, t: TFunction): string {
  const detail = chapter.topics.length > 0 ? t('resources.topicCount', { count: chapter.topics.length }) : t('resources.textbook');
  return `${t('resources.chapterLabel', { n: chapter.number })} \u2022 ${detail}`;
}

export const lastTopicKey = (schoolId: string, sectionId: string, chapterId: string) =>
  `resources:lastTopic:${schoolId}:${sectionId}:${chapterId}`;
