import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import type { TutorDiagnosticResult, TutorSessionView, TutorTurnResult, TutorTurnView } from '../api/types';
import { SchoolContext } from '../context/SchoolContext';
import en from '../i18n/locales/en.json';
import { TutorSessionScreen } from '../screens/principal/TutorSessionScreen';
import { JUST_TELL_ME_MESSAGE } from '../utils/tutor';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../components/LanguageSwitch', () => ({ LanguageSwitch: () => null }));
jest.mock('@expo/vector-icons', () => ({ FontAwesome5: () => null }));
jest.mock('../hooks/useKeyboardInset', () => ({ useKeyboardInset: () => 0 }));
jest.mock('../hooks/useComposerBottomPadding', () => ({ useComposerBottomPadding: () => 0 }));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-audio', () => ({
  AudioQuality: { MEDIUM: 'medium' },
  IOSOutputFormat: { MPEG4AAC: 'aac' },
  requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  useAudioRecorder: () => ({ uri: null, stop: jest.fn(), record: jest.fn(), prepareToRecordAsync: jest.fn() }),
}));
jest.mock('../api/tutor', () => ({
  answerTutorDiagnostic: jest.fn(),
  closeTutorSession: jest.fn(),
  getMyTutorAccess: jest.fn(() => Promise.resolve({ allowed: true, voiceInputAvailable: false })),
  getTutorSession: jest.fn(),
  sendTutorTurn: jest.fn(),
  transcribeTutorAudio: jest.fn(),
}));

const tutorApi = jest.requireMock('../api/tutor') as {
  answerTutorDiagnostic: jest.Mock;
  getTutorSession: jest.Mock;
  sendTutorTurn: jest.Mock;
};

beforeAll(() => {
  createInstance().use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    initAsync: false,
    interpolation: { escapeValue: false },
  });
});

const turn = (over: Partial<TutorTurnView>): TutorTurnView => ({
  id: 't1',
  seq: 1,
  role: 'TUTOR',
  stage: 'TEACH',
  content: 'Hello',
  citations: [],
  topicId: null,
  createdAt: '2026-11-16T10:00:00Z',
  latencyMs: null,
  ...over,
});

const baseSession: TutorSessionView = {
  id: 'sess-1',
  studentId: 'stu-1',
  chapterId: 'jesc1-c01',
  chapterNumber: 1,
  chapterTitle: 'Chemical Reactions and Equations',
  bookTitle: 'Science',
  mode: 'TEXT',
  status: 'ACTIVE',
  stage: 'RECAP',
  startedAt: '2026-11-16T10:00:00Z',
  endedAt: null,
  turnCount: 1,
  plan: { focusTopicId: null, focusTopicTitle: null, recapQuestions: [], steps: [], practice: [], focusPointIds: ['jesc1-c01-k2'] },
  turns: [turn({ id: 'open', content: 'Let us start with a quick check.', stage: 'RECAP' })],
  summary: null,
  parentNote: null,
  xpAwarded: null,
  flaggedReason: null,
};

const diagnosticSession: TutorSessionView = {
  ...baseSession,
  diagnostic: {
    items: [
      {
        id: 'd1',
        pointId: 'jesc1-c01-k1',
        stem: 'Which of these is a chemical change?',
        options: [
          { key: 'A', text: 'Melting ice' },
          { key: 'B', text: 'Burning paper' },
          { key: 'C', text: 'Dissolving sugar' },
          { key: 'D', text: 'Tearing paper' },
        ],
      },
      {
        id: 'd2',
        pointId: 'jesc1-c01-k2',
        stem: 'To balance H2 + O2 → H2O you should',
        options: [
          { key: 'A', text: 'change H2O to H2O2' },
          { key: 'B', text: 'put 2 in front of H2 and H2O' },
          { key: 'C', text: 'remove the O2' },
          { key: 'D', text: 'leave it: it is balanced' },
        ],
      },
    ],
  },
};

const teachTurn = turn({ id: 'teach-1', seq: 2, stage: 'TEACH', content: 'Good. Let us look at balancing.', knowledgePointId: 'jesc1-c01-k2', hintLevel: 0 });

const diagnosticResult: TutorDiagnosticResult = {
  results: [
    { itemId: 'd1', correct: true, misconception: null, remediation: null },
    { itemId: 'd2', correct: false, misconception: 'Changing subscripts to balance', remediation: 'Change the numbers in front, never the small numbers inside a formula.' },
  ],
  turn: teachTurn,
  stage: 'TEACH',
};

const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) };

function render(session: TutorSessionView) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SchoolContext.Provider value="school-1">
        <TutorSessionScreen route={{ key: 'r', name: 'TutorSession', params: { sessionId: session.id, session } }} navigation={navigation as never} />
      </SchoolContext.Provider>,
    );
  });
  return tree;
}

const flush = () => act(async () => {});

function textOf(node: ReactTestInstance): string {
  return node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
}
function texts(root: ReactTestRenderer | ReactTestInstance): string {
  const instance = 'root' in root ? root.root : root;
  return instance.findAllByType(Text).map(textOf).join('\n');
}
function byTestId(tree: ReactTestRenderer, testID: string): ReactTestInstance {
  return tree.root.findByProps({ testID });
}
function has(tree: ReactTestRenderer, testID: string): boolean {
  return tree.root.findAll((n) => n.props.testID === testID).length > 0;
}
function press(node: ReactTestInstance) {
  (node.props.onPress as () => void)();
}

jest.setTimeout(20000);

describe('TutorSessionScreen: diagnostic quick check (Phase 2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the items as option cards before the chat, with progress, and submits the picked keys', async () => {
    tutorApi.answerTutorDiagnostic.mockResolvedValue(diagnosticResult);
    const tree = render(diagnosticSession);
    await flush();

    expect(has(tree, 'tutor-diagnostic')).toBe(true);
    let out = texts(tree);
    expect(out).toContain(en.tutor.diagnostic.title);
    expect(out).toContain('0 of 2');
    expect(out).toContain('Which of these is a chemical change?');
    expect(out).toContain('Burning paper');
    // The chat and its composer wait until the check is answered.
    expect(out).not.toContain('Let us start with a quick check.');
    expect(tree.root.findAll((n) => n.props.testID === 'tutor-diagnostic-submit')[0].props.accessibilityState).toBeUndefined();
    expect(byTestId(tree, 'tutor-diagnostic-submit').props.disabled).toBe(true);

    act(() => press(byTestId(tree, 'tutor-diagnostic-option-d1-B')));
    expect(texts(tree)).toContain('1 of 2');
    expect(byTestId(tree, 'tutor-diagnostic-option-d1-B').props.accessibilityState).toEqual({ checked: true });
    expect(byTestId(tree, 'tutor-diagnostic-submit').props.disabled).toBe(true);

    act(() => press(byTestId(tree, 'tutor-diagnostic-option-d2-A')));
    expect(texts(tree)).toContain('2 of 2');
    expect(byTestId(tree, 'tutor-diagnostic-submit').props.disabled).toBe(false);

    await act(async () => press(byTestId(tree, 'tutor-diagnostic-submit')));
    expect(tutorApi.answerTutorDiagnostic).toHaveBeenCalledWith('school-1', 'sess-1', [
      { itemId: 'd1', key: 'B' },
      { itemId: 'd2', key: 'A' },
    ]);

    // The cards are gone; the per-item results sit above the chat, which continues from the TEACH turn.
    expect(has(tree, 'tutor-diagnostic')).toBe(false);
    expect(has(tree, 'tutor-diagnostic-results')).toBe(true);
    out = texts(tree);
    expect(out).toContain('Quick check: 1 of 2 right');
    expect(out).toContain(`Question 1: ${en.tutor.diagnostic.correct}`);
    expect(out).toContain('Question 2: Change the numbers in front, never the small numbers inside a formula.');
    expect(out).toContain('Good. Let us look at balancing.');
    expect(out).toContain('Let us start with a quick check.');
    expect(out).toContain(en.tutor.session.send);
  });

  it('Skip sends no answers and goes straight into the chat without a results card', async () => {
    tutorApi.answerTutorDiagnostic.mockResolvedValue({ ...diagnosticResult, results: [] });
    const tree = render(diagnosticSession);
    await flush();

    await act(async () => press(byTestId(tree, 'tutor-diagnostic-skip')));
    expect(tutorApi.answerTutorDiagnostic).toHaveBeenCalledWith('school-1', 'sess-1', []);
    expect(has(tree, 'tutor-diagnostic')).toBe(false);
    expect(has(tree, 'tutor-diagnostic-results')).toBe(false);
    expect(texts(tree)).toContain('Good. Let us look at balancing.');
  });

  it('keeps the cards and shows the error when the submit fails', async () => {
    tutorApi.answerTutorDiagnostic.mockRejectedValue(new Error('Network down'));
    const tree = render(diagnosticSession);
    await flush();

    await act(async () => press(byTestId(tree, 'tutor-diagnostic-skip')));
    expect(has(tree, 'tutor-diagnostic')).toBe(true);
    expect(texts(tree)).toContain('Network down');
  });

  it('a session without a diagnostic (older server or a resumed session) opens on the chat', async () => {
    const tree = render(baseSession);
    await flush();
    expect(has(tree, 'tutor-diagnostic')).toBe(false);
    expect(texts(tree)).toContain('Let us start with a quick check.');
    expect(tutorApi.answerTutorDiagnostic).not.toHaveBeenCalled();
  });
});

describe('TutorSessionScreen: hint ladder (Phase 2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tags tutor turns with their hint level and offers "Just tell me" after two hints on the same point', async () => {
    const tree = render({
      ...baseSession,
      turns: [
        turn({ id: 'q', seq: 1, content: 'Why does iron rust?', knowledgePointId: 'k3', hintLevel: 0 }),
        turn({ id: 's1', seq: 2, role: 'STUDENT', content: 'Because it is wet' }),
        turn({ id: 'h1', seq: 3, content: 'What made you think that?', knowledgePointId: 'k3', hintLevel: 1 }),
      ],
    });
    await flush();

    let out = texts(tree);
    expect(out).toContain('Hint 1 of 4');
    expect(has(tree, 'tutor-hint-h1')).toBe(true);
    expect(has(tree, 'tutor-hint-q')).toBe(false);
    expect(has(tree, 'tutor-just-tell-me')).toBe(false);

    // The second wrong try: the tutor climbs to level 2 on the same point.
    tutorApi.sendTutorTurn.mockResolvedValueOnce({
      turn: turn({ id: 'h2', seq: 5, content: 'Look at the passage on oxygen.', knowledgePointId: 'k3', hintLevel: 2 }),
      stage: 'TEACH',
      status: 'ACTIVE',
      notice: null,
      sessionEnded: false,
      hintLevel: 2,
      knowledgePointId: 'k3',
    } satisfies TutorTurnResult);
    const input = tree.root.findByProps({ placeholder: en.tutor.session.placeholder });
    act(() => (input.props.onChangeText as (text: string) => void)('Because of water'));
    await act(async () => press(tree.root.findAll((n) => n.props.accessibilityRole === 'button' && texts(n) === en.tutor.session.send)[0]));

    out = texts(tree);
    expect(out).toContain('Hint 2 of 4');
    expect(has(tree, 'tutor-just-tell-me')).toBe(true);

    tutorApi.sendTutorTurn.mockResolvedValueOnce({
      turn: turn({ id: 'a', seq: 7, content: 'Iron reacts with oxygen and water to form rust.', knowledgePointId: 'k3', hintLevel: 4 }),
      stage: 'TEACH',
      status: 'ACTIVE',
      notice: null,
      sessionEnded: false,
      hintLevel: 4,
      knowledgePointId: 'k3',
    } satisfies TutorTurnResult);
    await act(async () => press(byTestId(tree, 'tutor-just-tell-me')));
    expect(tutorApi.sendTutorTurn).toHaveBeenLastCalledWith('school-1', 'sess-1', JUST_TELL_ME_MESSAGE);
    out = texts(tree);
    expect(out).toContain(JUST_TELL_ME_MESSAGE);
    expect(out).toContain(en.tutor.hint.answer);
    // The answer is given: no more "Just tell me".
    expect(has(tree, 'tutor-just-tell-me')).toBe(false);
  });

  it('turns from an older server (no hint level) carry no tag', async () => {
    const tree = render(baseSession);
    await flush();
    expect(tree.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('tutor-hint-'))).toHaveLength(0);
    expect(texts(tree)).not.toContain('of 4');
  });
});
