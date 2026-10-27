import i18n from 'i18next';
import type { ReactElement } from 'react';
import { initReactI18next } from 'react-i18next';
import { Text } from 'react-native';

import type { TutorAccess, TutorChaptersResponse, TutorSessionList } from '../api/types';
import { SchoolContext } from '../context/SchoolContext';
import en from '../i18n/locales/en.json';
import { TutorChaptersScreen } from '../screens/principal/TutorChaptersScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../api/tutor', () => ({
  getMyTutorAccess: jest.fn(),
  getTutorChapters: jest.fn(),
  listTutorSessions: jest.fn(),
  startTutorSession: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../components/LanguageSwitch', () => ({ LanguageSwitch: () => null }));
jest.mock('@expo/vector-icons', () => ({ FontAwesome5: () => null }));

// react-test-renderer ships no types and the app adds no @types for it: the few calls used here are
// typed in place, the same way i18nParity.test.ts types Node's fs.
interface ReactTestInstance {
  props: Record<string, unknown>;
  children: (ReactTestInstance | string)[];
  findAllByType(type: unknown): ReactTestInstance[];
  findByProps(props: Record<string, unknown>): ReactTestInstance;
  findAll(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[];
}
interface ReactTestRenderer {
  root: ReactTestInstance;
}
const { act, create } = jest.requireActual<{
  act(callback: () => Promise<void> | void): Promise<void>;
  create(element: ReactElement): ReactTestRenderer;
}>('react-test-renderer');

const tutorApi = jest.requireMock('../api/tutor') as {
  getMyTutorAccess: jest.Mock;
  getTutorChapters: jest.Mock;
  listTutorSessions: jest.Mock;
  startTutorSession: jest.Mock;
};

const chapters: TutorChaptersResponse = {
  grade: 10,
  chapters: [
    {
      chapterId: 'jesc1-c01',
      bookCode: 'jesc1',
      bookTitle: 'Science',
      subjectKey: 'science',
      subjectName: 'Science',
      chapterNumber: 1,
      title: 'Chemical Reactions and Equations',
      topicCount: 2,
      ingested: true,
      mastery: 0.42,
      lastSessionAt: null,
    },
    {
      chapterId: 'jesc1-c02',
      bookCode: 'jesc1',
      bookTitle: 'Science',
      subjectKey: 'science',
      subjectName: 'Science',
      chapterNumber: 2,
      title: 'Acids, Bases and Salts',
      topicCount: 3,
      ingested: false,
      mastery: null,
      lastSessionAt: null,
    },
    {
      chapterId: 'jemh1-c01',
      bookCode: 'jemh1',
      bookTitle: 'Mathematics',
      subjectKey: 'maths',
      subjectName: 'Mathematics',
      chapterNumber: 1,
      title: 'Real Numbers',
      topicCount: 4,
      ingested: true,
      mastery: null,
      lastSessionAt: null,
    },
  ],
};

const access = (over: Partial<TutorAccess>): TutorAccess => ({
  studentId: 'stu-1',
  allowed: true,
  reason: null,
  entitlement: null,
  history: [],
  ...over,
});

const noSessions: TutorSessionList = { sessions: [] };

const navigation = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}) };

/** Every Text's own string content (a Text's `children` prop; nested elements are skipped). */
function texts(tree: ReactTestRenderer): string[] {
  const flat = (value: unknown): string =>
    Array.isArray(value) ? value.map(flat).join('') : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return tree.root.findAllByType(Text).map((node) => flat(node.props.children));
}

function chapterRow(tree: ReactTestRenderer, chapterId: string): ReactTestInstance {
  return tree.root.findByProps({ testID: `tutor-chapter-${chapterId}` });
}

function press(node: ReactTestInstance) {
  (node.props.onPress as () => void)();
}

async function renderScreen(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SchoolContext.Provider value="school-1">
        <TutorChaptersScreen navigation={navigation as never} route={{ key: 'k', name: 'TutorChapters', params: undefined } as never} />
      </SchoolContext.Provider>,
    );
  });
  return tree;
}

beforeAll(() =>
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  }),
);

beforeEach(() => {
  jest.clearAllMocks();
  tutorApi.getTutorChapters.mockResolvedValue(chapters);
  tutorApi.listTutorSessions.mockResolvedValue(noSessions);
});

// The first render of the screen loads i18n and the navigator on a cold Jest worker; CI runners are slower than a laptop.
jest.setTimeout(20000);

describe('TutorChaptersScreen', () => {
  it('locked: explains the premium state in plain words and keeps every chapter row disabled', async () => {
    tutorApi.getMyTutorAccess.mockResolvedValue(access({ allowed: false, reason: 'no_entitlement' }));
    const tree = await renderScreen();

    const shown = texts(tree);
    expect(shown).toContain(en.tutor.access.lockedTitle);
    expect(shown).toContain(en.tutor.access.noEntitlement);
    expect(shown).not.toContain(en.tutor.chapters.sessionsLeft);
    // The list is still there, grouped by subject, so the student sees what the tutor covers.
    expect(shown).toContain('Science');
    expect(shown).toContain('Mathematics');
    expect(shown).toContain('Chemical Reactions and Equations');
    expect(chapterRow(tree, 'jesc1-c01').props.accessibilityState).toEqual({ disabled: true });
    expect(chapterRow(tree, 'jemh1-c01').props.accessibilityState).toEqual({ disabled: true });
  });

  it('allowed: shows the sessions left, the mastery, and disables only chapters that are not ready', async () => {
    tutorApi.getMyTutorAccess.mockResolvedValue(
      access({
        entitlement: {
          id: 'e1',
          studentId: 'stu-1',
          plan: 'GRANT',
          status: 'ACTIVE',
          sessionsTotal: 10,
          sessionsUsed: 3,
          sessionsRemaining: 7,
          startsAt: '2026-10-01T00:00:00Z',
          expiresAt: null,
          source: 'ADMIN_GRANT',
          note: null,
          usable: true,
        },
      }),
    );
    const tree = await renderScreen();

    const shown = texts(tree);
    expect(shown).toContain(en.tutor.chapters.sessionsLeft);
    expect(shown).toContain('7');
    expect(shown).not.toContain(en.tutor.access.lockedTitle);
    expect(shown).toContain('42%');
    expect(shown).toContain(en.tutor.chapters.notReady);
    expect(chapterRow(tree, 'jesc1-c01').props.accessibilityState).toEqual({ disabled: false });
    expect(chapterRow(tree, 'jesc1-c02').props.accessibilityState).toEqual({ disabled: true });
    // No "continue" without a running session.
    expect(shown).not.toContain(en.tutor.chapters.continueSession);
  });

  it('allowed with unlimited sessions and a running one: offers to continue it', async () => {
    tutorApi.getMyTutorAccess.mockResolvedValue(access({}));
    tutorApi.listTutorSessions.mockResolvedValue({
      sessions: [
        {
          id: 'sess-9',
          chapterId: 'jesc1-c01',
          chapterTitle: 'Chemical Reactions and Equations',
          bookTitle: 'Science',
          mode: 'TEXT',
          status: 'ACTIVE',
          startedAt: '2026-10-26T10:00:00Z',
          endedAt: null,
          turnCount: 2,
          minutes: null,
          summary: null,
          parentNote: null,
        },
      ],
    });
    const tree = await renderScreen();

    const shown = texts(tree);
    expect(shown).toContain(en.tutor.chapters.unlimited);
    expect(shown).toContain(en.tutor.chapters.continueSession);
  });

  it('tapping a ready chapter offers Text / Voice and starts the session in the chosen mode', async () => {
    tutorApi.getMyTutorAccess.mockResolvedValue(access({}));
    tutorApi.startTutorSession.mockResolvedValue({ id: 'sess-1', turns: [] });
    const tree = await renderScreen();

    await act(async () => {
      press(chapterRow(tree, 'jesc1-c01'));
    });
    const voice = tree.root.findAll(
      (node) => node.props.accessibilityRole === 'button' && node.findAllByType(Text).some((text) => text.props.children === en.tutor.mode.voice),
    );
    expect(voice.length).toBeGreaterThan(0);
    await act(async () => {
      press(voice[0]);
    });

    expect(tutorApi.startTutorSession).toHaveBeenCalledWith('school-1', 'jesc1-c01', 'VOICE');
    expect(navigation.navigate).toHaveBeenCalledWith('TutorSession', { sessionId: 'sess-1', session: { id: 'sess-1', turns: [] } });
  });
});
