import type { ResourceBook, ResourceChapter, ResourceSubject, SectionResources } from '../api/types';
import {
  chapterHasVideo,
  formatDuration,
  initialExpandedSubject,
  resourceViewer,
  resourcesCacheKey,
  subjectSummary,
  textbookOpenPlan,
  topicLabel,
  visibleBooks,
  visibleChapters,
  withChapterHidden,
} from '../utils/resources';

const video = { mediaId: 'm1', url: 'https://cdn.example/leph1-c01/chapter/en.mp4', language: 'en', durationSec: 725, posterUrl: null };

function chapter(partial: Partial<ResourceChapter>): ResourceChapter {
  return {
    chapterId: 'leph1-c01',
    syllabusChapterId: 'sc-1',
    number: 1,
    title: 'Electric Charges and Fields',
    section: null,
    hidden: false,
    pdfUrl: 'https://ncert.nic.in/textbook/pdf/leph101.pdf',
    questionCount: 0,
    video: null,
    topics: [],
    ...partial,
  };
}

function book(partial: Partial<ResourceBook>): ResourceBook {
  return { bookCode: 'leph1', bookTitle: 'Physics Part-I', edition: 'current', chapters: [], ...partial };
}

function subject(partial: Partial<ResourceSubject>): ResourceSubject {
  return {
    subjectId: 's-phy',
    subjectName: 'Physics',
    subjectCode: 'PHY',
    teacherName: 'Meera',
    curriculumSubjectKey: 'physics',
    curriculumSubjectName: 'Physics',
    books: [],
    ...partial,
  };
}

const physics = subject({
  books: [
    book({
      chapters: [
        chapter({ video }),
        chapter({ chapterId: 'leph1-c02', syllabusChapterId: 'sc-2', number: 2, title: 'Electrostatic Potential', hidden: true }),
        chapter({
          chapterId: 'leph1-c03',
          syllabusChapterId: 'sc-3',
          number: 3,
          title: 'Current Electricity',
          topics: [{ topicId: 'leph1-c03-t01', number: '3.1', title: 'Introduction', video }],
        }),
      ],
    }),
    book({ bookCode: 'leph0', bookTitle: 'Old Physics', edition: 'legacy', chapters: [chapter({ chapterId: 'old-1', syllabusChapterId: 'old-sc' })] }),
  ],
});

describe('resourceViewer', () => {
  it('tells students, teachers and admins apart', () => {
    expect(resourceViewer({ role: 'STUDENT', ownerType: 'STUDENT' } as any)).toBe('student');
    expect(resourceViewer({ role: 'TEACHER', ownerType: 'EMPLOYEE' } as any)).toBe('teacher');
    expect(resourceViewer({ role: 'ADMIN', ownerType: 'EMPLOYEE' } as any)).toBe('admin');
  });
});

describe('visibleBooks / visibleChapters', () => {
  it('never shows a replaced (legacy) textbook', () => {
    expect(visibleBooks(physics).map((b) => b.bookCode)).toEqual(['leph1']);
  });

  it('drops a book with no chapters', () => {
    expect(visibleBooks(subject({ books: [book({})] }))).toEqual([]);
  });

  it('hides hidden chapters from students and shows them to staff', () => {
    const [current] = visibleBooks(physics);
    expect(visibleChapters(current, 'student').map((c) => c.number)).toEqual([1, 3]);
    expect(visibleChapters(current, 'teacher').map((c) => c.number)).toEqual([1, 2, 3]);
    expect(visibleChapters(current, 'admin').map((c) => c.number)).toEqual([1, 2, 3]);
  });
});

describe('chapterHasVideo / subjectSummary', () => {
  it('counts a chapter video and a topic video alike', () => {
    const [current] = visibleBooks(physics);
    expect(current.chapters.map(chapterHasVideo)).toEqual([true, false, true]);
  });

  it('summarises what the viewer will actually see', () => {
    expect(subjectSummary(physics, 'student')).toEqual({ chapters: 2, videos: 2 });
    expect(subjectSummary(physics, 'admin')).toEqual({ chapters: 3, videos: 2 });
  });

  it('opens the first subject that has chapters, else the first subject', () => {
    const unmapped = subject({ subjectId: 's-art', subjectName: 'Art', curriculumSubjectKey: null, books: [] });
    expect(initialExpandedSubject([unmapped, physics], 'student')).toBe('s-phy');
    expect(initialExpandedSubject([unmapped], 'student')).toBe('s-art');
    expect(initialExpandedSubject([], 'student')).toBeNull();
  });
});

describe('labels', () => {
  it('prefixes a topic with its printed number when there is one', () => {
    expect(topicLabel({ topicId: 't', number: '1.2', title: 'Electric Charge', video: null })).toBe('1.2  Electric Charge');
    expect(topicLabel({ topicId: 't', number: null, title: 'The Pālas', video: null })).toBe('The Pālas');
  });

  it('formats a duration as m:ss and hides an unknown one', () => {
    expect(formatDuration(725)).toBe('12:05');
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
  });

  it('keys the offline cache by school and section', () => {
    expect(resourcesCacheKey('school-1', 'sec-9')).toBe('resources:school-1:sec-9');
  });
});

describe('textbookOpenPlan', () => {
  const url = 'https://ncert.nic.in/textbook/pdf/leph101.pdf';
  it('renders in the WebView on iOS and hands off to the system on Android', () => {
    expect(textbookOpenPlan(url, 'ios')).toEqual({ kind: 'webview', url });
    expect(textbookOpenPlan(url, 'android')).toEqual({ kind: 'external', url });
  });
  it('has nothing to open without a link', () => {
    expect(textbookOpenPlan(null, 'ios')).toBeNull();
  });
});

describe('withChapterHidden', () => {
  it('flips one chapter and leaves everything else untouched', () => {
    const data: SectionResources = {
      classSectionId: 'sec-9',
      className: 'Class 12',
      section: 'A',
      grade: 12,
      generatedAt: '2026-10-18T00:00:00Z',
      subjects: [physics],
    };
    const next = withChapterHidden(data, 'sc-1', true);
    const [currentBook] = next.subjects[0].books;
    expect(currentBook.chapters.map((c) => c.hidden)).toEqual([true, true, false]);
    expect(physics.books[0].chapters[0].hidden).toBe(false);
    expect(next.subjects[0].books[1]).toBe(physics.books[1]);
  });
});
