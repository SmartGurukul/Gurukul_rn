import i18n from 'i18next';
import type { ReactElement } from 'react';
import { initReactI18next } from 'react-i18next';
import { Text } from 'react-native';

import type { TutorAccess, TutorChapterMap, TutorChaptersResponse, TutorSessionList } from '../api/types';
import { SchoolContext } from '../context/SchoolContext';
import en from '../i18n/locales/en.json';
import { TutorChaptersScreen } from '../screens/principal/TutorChaptersScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../api/tutor', () => ({
  getMyTutorAccess: jest.fn(),
  getTutorChapterMap: jest.fn(),
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
  findAll(predicate: (node: ReactTestInstance) => boolean, options?: { deep: boolean }): ReactTestInstance[];
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
  getTutorChapterMap: jest.Mock;
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

/** The Phase 2 knowledge map of chapter 1: one point per mastery band plus one never met. */
const chapterMap: TutorChapterMap = {
  chapterId: 'jesc1-c01',
  points: [
    { id: 'jesc1-c01-k1', topicId: 'tp1', title: 'What a chemical reaction is', description: 'A change that makes a new substance.', prerequisiteIds: [], mastery: 0.9, attempts: 4, misconceptions: [] },
    { id: 'jesc1-c01-k2', topicId: 'tp1', title: 'Balancing an equation', description: 'The same atoms on both sides.', prerequisiteIds: ['jesc1-c01-k1'], mastery: 0.5, attempts: 3, misconceptions: ['Changing subscripts to balance'] },
    { id: 'jesc1-c01-k3', topicId: 'tp2', title: 'Displacement reactions', description: 'A more reactive metal pushes out a less reactive one.', prerequisiteIds: ['jesc1-c01-k2'], mastery: 0.2, attempts: 2, misconceptions: [] },
    { id: 'jesc1-c01-k4', topicId: 'tp2', title: 'Redox', description: 'Oxidation and reduction happen together.', prerequisiteIds: ['jesc1-c01-k3'], mastery: null, attempts: 0, misconceptions: [] },
  ],
};

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
  tutorApi.getTutorChapterMap.mockResolvedValue(chapterMap);
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

  describe('mastery strip (Phase 2 knowledge map)', () => {
    it('loads the map only for chapters the student opened before, and shows one chip per point', async () => {
      tutorApi.getMyTutorAccess.mockResolvedValue(access({}));
      tutorApi.getTutorChapters.mockResolvedValue({
        ...chapters,
        chapters: chapters.chapters.map((c) => (c.chapterId === 'jesc1-c01' ? { ...c, lastSessionAt: '2026-11-10T10:00:00Z' } : c)),
      });
      const tree = await renderScreen();

      // One request, for the chapter with a session; the untouched ready chapter waits for a tap.
      expect(tutorApi.getTutorChapterMap).toHaveBeenCalledTimes(1);
      expect(tutorApi.getTutorChapterMap).toHaveBeenCalledWith('school-1', 'jesc1-c01');
      const chips = tree.root.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('tutor-point-'), { deep: false });
      expect(chips.map((chip) => chip.props.testID)).toEqual(['tutor-point-jesc1-c01-k1', 'tutor-point-jesc1-c01-k2', 'tutor-point-jesc1-c01-k3', 'tutor-point-jesc1-c01-k4']);
      // Colour by band: green ≥ 0.7, marigold ≥ 0.4, red below, grey before any attempt.
      const colorOf = (chip: ReactTestInstance) => (chip.props.style as { backgroundColor: string }[]).find((s) => s && 'backgroundColor' in s)?.backgroundColor;
      expect(chips.map(colorOf)).toEqual(['#1E9E5A', '#F5A70A', '#D6453D', '#E6E1EF']);
      // The never-opened ready chapter offers to show its points; the not-ready one offers nothing.
      expect(tree.root.findAll((node) => node.props.testID === 'tutor-map-toggle-jemh1-c01', { deep: false })).toHaveLength(1);
      expect(tree.root.findAll((node) => node.props.testID === 'tutor-map-toggle-jesc1-c02')).toHaveLength(0);
    });

    it('fetches a map on demand from "Show points" and opens a point\'s title and description from its chip', async () => {
      tutorApi.getMyTutorAccess.mockResolvedValue(access({}));
      tutorApi.getTutorChapterMap.mockResolvedValue({ ...chapterMap, chapterId: 'jemh1-c01' });
      const tree = await renderScreen();
      expect(tutorApi.getTutorChapterMap).not.toHaveBeenCalled();

      await act(async () => {
        press(tree.root.findByProps({ testID: 'tutor-map-toggle-jemh1-c01' }));
      });
      expect(tutorApi.getTutorChapterMap).toHaveBeenCalledWith('school-1', 'jemh1-c01');
      expect(tree.root.findAll((node) => node.props.testID === 'tutor-map-toggle-jemh1-c01')).toHaveLength(0);

      expect(texts(tree)).not.toContain('Balancing an equation');
      await act(async () => {
        press(tree.root.findByProps({ testID: 'tutor-point-jesc1-c01-k2' }));
      });
      const shown = texts(tree);
      expect(shown).toContain('Balancing an equation');
      expect(shown).toContain('The same atoms on both sides.');
      expect(shown).toContain('50% mastered');
      expect(shown).toContain('Mix-ups seen: Changing subscripts to balance');
    });

    it('a failed map load offers a retry instead of breaking the list', async () => {
      tutorApi.getMyTutorAccess.mockResolvedValue(access({}));
      tutorApi.getTutorChapterMap.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(chapterMap);
      tutorApi.getTutorChapters.mockResolvedValue({
        ...chapters,
        chapters: chapters.chapters.map((c) => (c.chapterId === 'jesc1-c01' ? { ...c, lastSessionAt: '2026-11-10T10:00:00Z' } : c)),
      });
      const tree = await renderScreen();

      expect(texts(tree)).toContain(en.tutor.map.retry);
      expect(texts(tree)).toContain('Chemical Reactions and Equations');
      await act(async () => {
        press(tree.root.findByProps({ testID: 'tutor-map-toggle-jesc1-c01' }));
      });
      expect(tutorApi.getTutorChapterMap).toHaveBeenCalledTimes(2);
      expect(tree.root.findAll((node) => node.props.testID === 'tutor-point-jesc1-c01-k1', { deep: false })).toHaveLength(1);
    });
  });
});
