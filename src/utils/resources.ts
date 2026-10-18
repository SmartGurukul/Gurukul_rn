import type { LoginResponse, ResourceBook, ResourceChapter, ResourceSubject, ResourceTopic } from '../api/types';

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
