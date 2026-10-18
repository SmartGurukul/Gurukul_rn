import type { ResourceBook, ResourceChapter, ResourceSubject, SectionResources } from '../api/types';
import { tEn, tHi } from '../testUtils/i18nFixture';
import {
  chapterHasVideo,
  connectorPath,
  currentStepIndex,
  durationMinutes,
  eyebrowText,
  formatDuration,
  isDimmed,
  journeySteps,
  lastOpenedKey,
  stepSide,
  stepTone,
  subjectIcon,
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

describe('journey steps', () => {
  it('alternates sides starting on the left', () => {
    expect([0, 1, 2, 3].map(stepSide)).toEqual(['left', 'right', 'left', 'right']);
  });

  it('walks the books in order, skipping legacy books and, for students, hidden chapters', () => {
    const partTwo = book({ bookCode: 'leph2', bookTitle: 'Physics Part-II', chapters: [chapter({ chapterId: 'leph2-c01', syllabusChapterId: 'sc-9', number: 9, title: 'Ray Optics' })] });
    const withParts = subject({ books: [...physics.books, partTwo] });
    expect(journeySteps(withParts, 'student').map((s) => [s.index, s.side, s.chapter.chapterId])).toEqual([
      [0, 'left', 'leph1-c01'],
      [1, 'right', 'leph1-c03'],
      [2, 'left', 'leph2-c01'],
    ]);
    expect(journeySteps(withParts, 'teacher').map((s) => s.chapter.chapterId)).toEqual(['leph1-c01', 'leph1-c02', 'leph1-c03', 'leph2-c01']);
  });

  it('picks the current step: last opened, else the first with a video, else the first', () => {
    const steps = journeySteps(physics, 'admin');
    expect(currentStepIndex(steps, 'leph1-c03')).toBe(2);
    expect(currentStepIndex(steps, 'not-in-this-subject')).toBe(0);
    expect(currentStepIndex(steps, null)).toBe(0);
    const noVideo = journeySteps(subject({ books: [book({ chapters: [chapter({ chapterId: 'a' }), chapter({ chapterId: 'b', number: 2 })] })] }), 'student');
    expect(currentStepIndex(noVideo, null)).toBe(0);
    expect(currentStepIndex([], null)).toBe(-1);
  });

  it('dims the steps after the current one and hidden ones, never the ones before', () => {
    const steps = journeySteps(physics, 'admin');
    expect(steps.map((s) => stepTone(s, 2))).toEqual(['done', 'hidden', 'current']);
    expect(steps.map((s) => stepTone(s, 0))).toEqual(['current', 'hidden', 'upcoming']);
    expect(['current', 'done', 'upcoming', 'hidden'].map((tone) => isDimmed(tone as any))).toEqual([false, false, true, true]);
  });

  it('writes the eyebrow from the video length, else the topic count, else the textbook', () => {
    expect(eyebrowText(chapter({ video }), tEn)).toBe('Chapter 1 \u2022 12 min');
    expect(eyebrowText(chapter({ number: 3, topics: [{ topicId: 't', number: '3.1', title: 'Intro', video: null }] }), tEn)).toBe('Chapter 3 \u2022 1 topics');
    expect(eyebrowText(chapter({ number: 4 }), tEn)).toBe('Chapter 4 \u2022 Textbook');
    expect(eyebrowText(chapter({ video }), tHi)).toBe('\u0905\u0927\u094d\u092f\u093e\u092f 1 \u2022 12 \u092e\u093f\u0928\u091f');
    expect(durationMinutes(30)).toBe(1);
    expect(durationMinutes(null)).toBeNull();
  });

  it('keys the last-opened chapter per school, section and subject', () => {
    expect(lastOpenedKey('school-1', 'sec-9', 's-phy')).toBe('resources:last:school-1:sec-9:s-phy');
  });

  it('picks a glyph per catalogue subject and falls back to an open book', () => {
    expect(subjectIcon('mathematics')).toBe('calculator');
    expect(subjectIcon('physics')).toBe('atom');
    expect(subjectIcon('social-science')).toBe('globe');
    expect(subjectIcon('english')).toBe('book');
    expect(subjectIcon('computer-science')).toBe('laptop');
    expect(subjectIcon('accountancy')).toBe('chart-line');
    expect(subjectIcon(null)).toBe('book-open');
    expect(subjectIcon('psychology')).toBe('book-open');
  });

  it('draws the connector from under one thumbnail to the top of the next on the other side', () => {
    expect(connectorPath(300, 80, 'left', 100)).toBe('M 50 0 C 50 40, 250 40, 250 80');
    expect(connectorPath(300, 80, 'right', 100)).toBe('M 250 0 C 250 40, 50 40, 50 80');
  });
});
