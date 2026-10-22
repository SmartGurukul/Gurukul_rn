import { ApiError } from '../api/client';
import type { AnnouncementAudiences, AnnouncementAudienceSection } from '../api/types';
import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import {
  NOTICE_LIMITS,
  audienceKinds,
  canSend,
  chosenAudience,
  confirmKey,
  createNoticeSendGuard,
  hasAudience,
  mayPostNotices,
  normaliseBody,
  normaliseTitle,
  noticeEntryVisible,
  sectionLabel,
  showYears,
  sortGrades,
  sortSections,
  toCreateRequest,
  type NoticeAudience,
} from '../utils/announcementCompose';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Reads two source files with Node's fs, typed here (as in i18nParity.test.ts) rather than through
// @types/node, which would put Node globals into the type check for all the app code.
declare const __dirname: string;
const fs = jest.requireActual<{ readFileSync(file: string, encoding: 'utf8'): string }>('fs');

function section(className: string, name: string, academicYear = '2026-27'): AnnouncementAudienceSection {
  return {
    sectionId: `${className}-${name}-${academicYear}`,
    className,
    section: name,
    academicYear,
    displayLabel: `${className} - ${name} (${academicYear})`,
  };
}

const ADMIN: AnnouncementAudiences = {
  canPost: true,
  school: true,
  sections: [section('Grade 8', 'A'), section('Grade 8', 'B')],
  grades: ['Grade 8'],
};
const TEACHER: AnnouncementAudiences = { canPost: true, school: false, sections: [section('Grade 8', 'A')], grades: ['Grade 8'] };
const NONE: AnnouncementAudiences = { canPost: false, school: false, sections: [], grades: [] };

const SCHOOL: NoticeAudience = { kind: 'SCHOOL' };
const CLASS: NoticeAudience = { kind: 'CLASS', sectionId: 's1' };
const GRADE: NoticeAudience = { kind: 'GRADE', className: 'Grade 8' };

describe('mayPostNotices', () => {
  it('asks the server only for admins and teachers', () => {
    expect(mayPostNotices('ADMIN')).toBe(true);
    expect(mayPostNotices('TEACHER')).toBe(true);
    for (const role of ['STUDENT', 'PARENT', 'DRIVER', null, undefined] as const) {
      expect(mayPostNotices(role)).toBe(false);
    }
  });
});

describe('audienceKinds / hasAudience', () => {
  it('offers an admin the whole school, a section and a class, in that order', () => {
    expect(audienceKinds(ADMIN)).toEqual(['SCHOOL', 'CLASS', 'GRADE']);
    expect(hasAudience(ADMIN)).toBe(true);
  });

  it('offers a class teacher their section and its class, never the whole school', () => {
    expect(audienceKinds(TEACHER)).toEqual(['CLASS', 'GRADE']);
    expect(hasAudience(TEACHER)).toBe(true);
  });

  it('offers nothing to someone who may not post', () => {
    expect(audienceKinds(NONE)).toEqual([]);
    expect(hasAudience(NONE)).toBe(false);
    expect(hasAudience(null)).toBe(false);
    expect(hasAudience(undefined)).toBe(false);
  });

  it('shows no form when canPost is true but there is nothing to offer, or canPost is false', () => {
    expect(hasAudience({ ...NONE, canPost: true })).toBe(false);
    expect(hasAudience({ ...TEACHER, canPost: false })).toBe(false);
  });
});

describe('sortSections / sortGrades', () => {
  it('puts Grade 2 before Grade 10 (numeric, not plain string order)', () => {
    const sorted = sortSections([section('Grade 10', 'A'), section('Grade 2', 'B'), section('Grade 2', 'A')]);
    expect(sorted.map((s) => `${s.className}/${s.section}`)).toEqual(['Grade 2/A', 'Grade 2/B', 'Grade 10/A']);
    expect(sortGrades(['Grade 10', 'Grade 2', 'Grade 1'])).toEqual(['Grade 1', 'Grade 2', 'Grade 10']);
  });

  it('lists the latest academic year first for the same section', () => {
    const sorted = sortSections([section('Grade 8', 'A', '2025-26'), section('Grade 8', 'A', '2026-27')]);
    expect(sorted.map((s) => s.academicYear)).toEqual(['2026-27', '2025-26']);
  });

  it('does not change the lists it is given, and lists each class once', () => {
    const sections = [section('Grade 10', 'A'), section('Grade 2', 'A')];
    const grades = ['Grade 10', 'Grade 2', 'Grade 10'];
    sortSections(sections);
    expect(sortGrades(grades)).toEqual(['Grade 2', 'Grade 10']);
    expect(sections[0].className).toBe('Grade 10');
    expect(grades).toEqual(['Grade 10', 'Grade 2', 'Grade 10']);
  });
});

describe('sectionLabel / showYears', () => {
  it('names the class and section, with the year only when asked', () => {
    expect(sectionLabel(section('Grade 8', 'A'), false)).toBe('Grade 8 - A');
    expect(sectionLabel(section('Grade 8', 'A'), true)).toBe('Grade 8 - A (2026-27)');
  });

  it('needs the year only when the sections span more than one academic year', () => {
    expect(showYears([section('Grade 8', 'A'), section('Grade 9', 'A')])).toBe(false);
    expect(showYears([section('Grade 8', 'A', '2025-26'), section('Grade 8', 'A', '2026-27')])).toBe(true);
    expect(showYears([])).toBe(false);
  });
});

describe('normaliseTitle / normaliseBody (the server rules)', () => {
  it('makes the title one line with single spaces', () => {
    expect(normaliseTitle('  Holiday \n tomorrow ')).toBe('Holiday tomorrow');
    expect(normaliseTitle('a\t\tb\r\nc')).toBe('a b c');
    expect(normaliseTitle(' \n\t ')).toBe('');
  });

  it('keeps the body line breaks, as \\n, and trims its ends', () => {
    expect(normaliseBody('\r\n Line 1\r\nLine 2\rLine 3 \n')).toBe('Line 1\nLine 2\nLine 3');
    expect(normaliseBody('Para 1\n\n  Para 2')).toBe('Para 1\n\n  Para 2');
    expect(normaliseBody('  \r\n ')).toBe('');
  });
});

describe('chosenAudience', () => {
  it('is complete only once the section or class is picked', () => {
    expect(chosenAudience(null, null, null)).toBeNull();
    expect(chosenAudience('SCHOOL', null, null)).toEqual({ kind: 'SCHOOL' });
    expect(chosenAudience('CLASS', null, 'Grade 8')).toBeNull();
    expect(chosenAudience('CLASS', 's1', null)).toEqual({ kind: 'CLASS', sectionId: 's1' });
    expect(chosenAudience('GRADE', 's1', null)).toBeNull();
    expect(chosenAudience('GRADE', null, 'Grade 8')).toEqual({ kind: 'GRADE', className: 'Grade 8' });
  });
});

describe('canSend', () => {
  const text = (n: number) => 'x'.repeat(n);

  it('needs a title of 1 to 200 characters', () => {
    expect(canSend(SCHOOL, text(0), 'Body')).toBe(false);
    expect(canSend(SCHOOL, text(1), 'Body')).toBe(true);
    expect(canSend(SCHOOL, text(NOTICE_LIMITS.title), 'Body')).toBe(true);
    expect(canSend(SCHOOL, text(NOTICE_LIMITS.title + 1), 'Body')).toBe(false);
  });

  it('needs a message of 1 to 4000 characters', () => {
    expect(canSend(SCHOOL, 'Title', text(0))).toBe(false);
    expect(canSend(SCHOOL, 'Title', text(1))).toBe(true);
    expect(canSend(SCHOOL, 'Title', text(NOTICE_LIMITS.body))).toBe(true);
    expect(canSend(SCHOOL, 'Title', text(NOTICE_LIMITS.body + 1))).toBe(false);
  });

  it('measures the text as the server will store it', () => {
    expect(canSend(SCHOOL, '   \n ', 'Body')).toBe(false);
    expect(canSend(SCHOOL, 'Title', ' \r\n ')).toBe(false);
    // 201 typed characters that normalise to 200 are fine.
    expect(canSend(SCHOOL, ` ${text(NOTICE_LIMITS.title)}`, 'Body')).toBe(true);
  });

  it('needs the audience fully chosen', () => {
    expect(canSend(null, 'Title', 'Body')).toBe(false);
    expect(canSend(chosenAudience('CLASS', null, null), 'Title', 'Body')).toBe(false);
    expect(canSend({ kind: 'CLASS', sectionId: '' }, 'Title', 'Body')).toBe(false);
    expect(canSend({ kind: 'GRADE', className: '' }, 'Title', 'Body')).toBe(false);
    expect(canSend(CLASS, 'Title', 'Body')).toBe(true);
    expect(canSend(GRADE, 'Title', 'Body')).toBe(true);
  });
});

describe('toCreateRequest', () => {
  it('sends only the scope’s own target field, with the normalised text', () => {
    expect(toCreateRequest(SCHOOL, ' School \n closed ', ' Body\r\n ')).toEqual({
      scope: 'SCHOOL',
      title: 'School closed',
      body: 'Body',
    });
    expect(toCreateRequest(CLASS, 'T', 'B')).toEqual({ scope: 'CLASS', sectionId: 's1', title: 'T', body: 'B' });
    expect(toCreateRequest(GRADE, 'T', 'B')).toEqual({ scope: 'GRADE', className: 'Grade 8', title: 'T', body: 'B' });
  });
});

describe('confirmKey', () => {
  it('names who is notified for each audience', () => {
    expect(confirmKey(SCHOOL)).toBe('confirmSchool');
    expect(confirmKey(CLASS)).toBe('confirmSection');
    expect(confirmKey(GRADE)).toBe('confirmGrade');
  });
});

describe('noticeEntryVisible ("Post a notice" on School Events)', () => {
  it('never asks the server for anyone but an admin or teacher', async () => {
    for (const role of ['STUDENT', 'PARENT', 'DRIVER', null, undefined] as const) {
      const load = jest.fn(() => Promise.resolve(ADMIN));
      await expect(noticeEntryVisible(role, load)).resolves.toBe(false);
      expect(load).not.toHaveBeenCalled();
    }
  });

  it('shows the button only when the server has somewhere for this person to post', async () => {
    await expect(noticeEntryVisible('ADMIN', () => Promise.resolve(ADMIN))).resolves.toBe(true);
    await expect(noticeEntryVisible('TEACHER', () => Promise.resolve(TEACHER))).resolves.toBe(true);
    await expect(noticeEntryVisible('TEACHER', () => Promise.resolve(NONE))).resolves.toBe(false);
  });

  it('hides the button, and never rejects, when the audiences call fails (an older server answers 404)', async () => {
    const notFound = new ApiError('No static resource api/v1/chat/announcements/audiences.', 404);
    await expect(noticeEntryVisible('ADMIN', () => Promise.reject(notFound))).resolves.toBe(false);
    const offline = new Error('Network request failed');
    await expect(noticeEntryVisible('TEACHER', () => Promise.reject(offline))).resolves.toBe(false);
    const throwsAtOnce = (): Promise<AnnouncementAudiences> => {
      throw new Error('boom');
    };
    await expect(noticeEntryVisible('ADMIN', throwsAtOnce)).resolves.toBe(false);
  });
});

describe('createNoticeSendGuard (Send, the confirmation and the request)', () => {
  /** A request that ends only when the test says so. */
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  it('opens one confirmation for a double tap on Send', () => {
    const guard = createNoticeSendGuard();
    expect(guard.openConfirm()).toBe(true);
    expect(guard.openConfirm()).toBe(false);
  });

  it('lets Send open it again after Cancel, or Android Back or a tap outside (onDismiss)', () => {
    const guard = createNoticeSendGuard();
    for (let i = 0; i < 3; i += 1) {
      expect(guard.openConfirm()).toBe(true);
      guard.closeConfirm();
      // Android reports a button or a dismissal, never both; a second close is harmless anyway.
      guard.closeConfirm();
    }
    expect(guard.openConfirm()).toBe(true);
  });

  it('sends once: taps while it sends open nothing and send nothing, and Back is held', async () => {
    const guard = createNoticeSendGuard();
    const request = deferred<string>();
    const post = jest.fn(() => request.promise);

    expect(guard.openConfirm()).toBe(true);
    guard.closeConfirm(); // the dialog's Send
    const first = guard.send(post);
    expect(guard.inFlight.current).toBe(true); // useHoldWhileSaving keeps the form on screen
    expect(guard.openConfirm()).toBe(false); // Send tapped again before it re-renders disabled
    await expect(guard.send(post)).resolves.toEqual({ status: 'busy' });
    expect(post).toHaveBeenCalledTimes(1);

    request.resolve('notice-1');
    await expect(first).resolves.toEqual({ status: 'sent', value: 'notice-1' });
    // Clear before the screen goes back, so the hold lets that navigation through.
    expect(guard.inFlight.current).toBe(false);
  });

  it('keeps the form for a retry after a failure (the server stopped mid-send)', async () => {
    const guard = createNoticeSendGuard();
    const lost = new Error('Network request failed');
    const post = jest.fn<Promise<string>, []>().mockRejectedValueOnce(lost).mockResolvedValueOnce('notice-1');

    await expect(guard.send(post)).resolves.toEqual({ status: 'failed', error: lost });
    expect(guard.inFlight.current).toBe(false);
    expect(guard.openConfirm()).toBe(true);
    guard.closeConfirm();
    // The retry reaches the server, which answers an identical notice within 10 minutes with the
    // earlier one ("Announcement already posted"), so nobody is notified twice.
    await expect(guard.send(post)).resolves.toEqual({ status: 'sent', value: 'notice-1' });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('treats a request that throws at once as a failure, not a send stuck in flight', async () => {
    const guard = createNoticeSendGuard();
    const broken = new Error('boom');
    const post = (): Promise<string> => {
      throw broken;
    };
    await expect(guard.send(post)).resolves.toEqual({ status: 'failed', error: broken });
    expect(guard.inFlight.current).toBe(false);
  });
});

describe('announcementCompose strings', () => {
  type Block = Record<string, string>;
  const EN = (en as unknown as { announcementCompose: Block }).announcementCompose;
  const HI = (hi as unknown as { announcementCompose: Block }).announcementCompose;

  it('has every key in Hindi, written in Hindi rather than pasted English', () => {
    expect(Object.keys(HI).sort()).toEqual(Object.keys(EN).sort());
    const hasWords = (value: string) => /[A-Za-z]/.test(value.replace(/\{\{[^}]*\}\}/g, ''));
    const english = Object.keys(EN)
      .filter((k) => hasWords(EN[k]))
      .filter((k) => !/[ऀ-ॿ]/.test(HI[k]));
    expect(english).toEqual([]);
  });
});

describe('the way in', () => {
  // A merge or refactor of School Events that drops the button would leave the composer unreachable
  // with every other test still green.
  const source = (file: string) => fs.readFileSync(`${__dirname}/../${file}`, 'utf8');

  it('School Events opens the composer, behind noticeEntryVisible, and the stack registers it', () => {
    const list = source('screens/principal/EventsListScreen.tsx');
    expect(list).toContain("navigation.navigate('AnnouncementCompose')");
    expect(list).toContain('noticeEntryVisible(');
    expect(list).toContain("t('announcementCompose.entry')");
    expect(source('navigation/PrincipalNavigator.tsx')).toContain('name="AnnouncementCompose"');
  });
});
