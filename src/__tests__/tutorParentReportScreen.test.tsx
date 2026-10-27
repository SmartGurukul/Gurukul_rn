import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { SchoolContext } from '../context/SchoolContext';
import en from '../i18n/locales/en.json';
import { TutorParentReportScreen } from '../screens/principal/TutorParentReportScreen';
import type { TutorReport } from '../api/types';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../api/tutor', () => ({ getTutorReport: jest.fn() }));

const { getTutorReport } = jest.requireMock<{ getTutorReport: jest.Mock }>('../api/tutor');

beforeAll(() => {
  createInstance().use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    initAsync: false,
    interpolation: { escapeValue: false },
  });
});

const emptyReport: TutorReport = {
  studentId: 's1',
  studentName: 'Riya Sharma',
  access: { allowed: false, reason: 'no_entitlement', plan: null, sessionsRemaining: null, expiresAt: null },
  week: { start: '2026-10-19', end: '2026-10-25', sessions: 0, minutes: 0, quizScore: null },
  total: { sessions: 0, minutes: 0, firstSessionAt: null },
  conceptsThisWeek: [],
  strengths: [],
  gaps: [],
  nextPlan: null,
  chapters: [],
  quizTrend: [],
  recentSessions: [],
  profileSummary: null,
};

const fullReport: TutorReport = {
  ...emptyReport,
  access: { allowed: true, reason: null, plan: 'TRIAL', sessionsRemaining: 12, expiresAt: '2027-03-31T00:00:00Z' },
  week: { start: '2026-10-19', end: '2026-10-25', sessions: 3, minutes: 42, quizScore: { score: 4, total: 5 } },
  total: { sessions: 7, minutes: 95, firstSessionAt: '2026-09-30T10:00:00Z' },
  conceptsThisWeek: [{ topicId: 'tp1', title: 'Balancing equations', chapterTitle: 'Chemical Reactions', mastery: 0.8 }],
  strengths: [{ topicId: 'tp1', title: 'Balancing equations', mastery: 0.8 }],
  gaps: [{ topicId: 'tp2', title: 'Types of reactions', mastery: 0.3 }],
  nextPlan: 'Revise displacement reactions next.',
  chapters: [
    {
      chapterId: 'jesc1-c01',
      chapterNumber: 1,
      title: 'Chemical Reactions and Equations',
      bookTitle: 'Science',
      mastery: 0.55,
      sessions: 4,
      topics: [{ topicId: 'tp1', topicNumber: '1.1', title: 'Balancing equations', mastery: 0.8, attempts: 3, lastSeenAt: '2026-10-24T10:00:00Z' }],
    },
  ],
  quizTrend: [
    { weekStart: '2026-10-12', score: 3, total: 5 },
    { weekStart: '2026-10-19', score: 4, total: 5 },
  ],
  recentSessions: [
    {
      id: 'sess1',
      chapterId: 'jesc1-c01',
      chapterTitle: 'Chemical Reactions and Equations',
      bookTitle: 'Science',
      mode: 'TEXT',
      status: 'CLOSED',
      startedAt: '2026-10-24T10:00:00Z',
      endedAt: '2026-10-24T10:15:00Z',
      turnCount: 12,
      minutes: 15,
      summary: 'Practised balancing three equations.',
      parentNote: 'Ask Riya to explain a balanced equation at dinner.',
    },
  ],
  profileSummary: 'Riya learns best from worked examples.',
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

function render(props: { studentId: string; studentName?: string }) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SchoolContext.Provider value="school-1">
        <TutorParentReportScreen
          route={{ key: 'r', name: 'TutorParentReport', params: props }}
          navigation={navigation as never}
        />
      </SchoolContext.Provider>
    );
  });
  return tree;
}

const flush = () => act(async () => {});

/** Every Text's string content, one per line, so a test can look for what the screen says. */
function textOf(node: ReactTestInstance): string {
  return node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
}
function texts(root: ReactTestRenderer | ReactTestInstance): string {
  const instance = 'root' in root ? root.root : root;
  return instance.findAllByType(Text).map(textOf).join('\n');
}

describe('TutorParentReportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the hero, access line, strengths, gaps, chapters and sessions for a report with data', async () => {
    getTutorReport.mockResolvedValue(fullReport);
    const tree = render({ studentId: 's1', studentName: 'Riya' });
    await flush();

    expect(getTutorReport).toHaveBeenCalledWith('school-1', 's1');
    const out = texts(tree);
    expect(out).toContain('Riya Sharma');
    expect(out).toContain('42');
    expect(out).toContain('4/5');
    expect(out).toContain('AI Tutor active · 12 sessions left · until 31 Mar 2027');
    expect(out).toContain('Balancing equations');
    expect(out).toContain('Types of reactions');
    expect(out).toContain('Revise displacement reactions next.');
    expect(out).toContain('3/5');
    expect(out).toContain('Ch 1: Chemical Reactions and Equations');
    expect(out).toContain('Practised balancing three equations.');
    expect(out).toContain('Ask Riya to explain a balanced equation at dinner.');
    expect(out).toContain('Riya learns best from worked examples.');
    expect(out).toContain('7 sessions and 95 minutes in all');
    expect(out).not.toContain('No sessions yet');
  });

  it('opens the transcript when a session is tapped and expands a chapter', async () => {
    getTutorReport.mockResolvedValue(fullReport);
    const tree = render({ studentId: 's1' });
    await flush();

    const buttons = tree.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function');
    const chapter = buttons.find((n) => n.props.accessibilityState?.expanded === false);
    expect(chapter).toBeDefined();
    expect(texts(tree)).not.toContain('last seen');
    act(() => chapter!.props.onPress());
    expect(texts(tree)).toContain('last seen 24 Oct');

    const session = buttons.find((n) => n !== chapter && texts(n).includes('Practised'));
    expect(session).toBeDefined();
    act(() => session!.props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith('TutorTranscript', { sessionId: 'sess1' });
  });

  it('shows the empty state and the inactive access line before any session', async () => {
    getTutorReport.mockResolvedValue(emptyReport);
    const tree = render({ studentId: 's1', studentName: 'Riya' });
    await flush();

    const out = texts(tree);
    expect(out).toContain('No sessions yet');
    expect(out).toContain('The first report appears after the first session.');
    expect(out).toContain('Not active: ask the school to switch it on');
    expect(out).not.toContain('Recent sessions');
  });

  it('shows the error with a retry when the report fails to load', async () => {
    getTutorReport.mockRejectedValueOnce(new Error('Student not found')).mockResolvedValueOnce(emptyReport);
    const tree = render({ studentId: 's1' });
    await flush();
    expect(texts(tree)).toContain('Student not found');

    const retry = tree.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function');
    act(() => retry[retry.length - 1].props.onPress());
    await flush();
    expect(getTutorReport).toHaveBeenCalledTimes(2);
    expect(texts(tree)).toContain('No sessions yet');
  });
});
