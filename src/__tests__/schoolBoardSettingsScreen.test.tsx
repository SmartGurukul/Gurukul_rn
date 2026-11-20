import i18n from 'i18next';
import type { ReactElement } from 'react';
import { initReactI18next } from 'react-i18next';
import { Text } from 'react-native';

import type { School } from '../api/types';
import { SchoolContext } from '../context/SchoolContext';
import en from '../i18n/locales/en.json';
import { SchoolBoardSettingsScreen } from '../screens/principal/SchoolBoardSettingsScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../api/schools', () => ({ getSchool: jest.fn(), updateSchool: jest.fn() }));
const mockShowToast = jest.fn();
jest.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../components/LanguageSwitch', () => ({ LanguageSwitch: () => null }));
jest.mock('@expo/vector-icons', () => ({ FontAwesome5: () => null }));

interface ReactTestInstance {
  props: Record<string, unknown>;
  findAllByType(type: unknown): ReactTestInstance[];
  findByProps(props: Record<string, unknown>): ReactTestInstance;
}
interface ReactTestRenderer {
  root: ReactTestInstance;
}
const { act, create } = jest.requireActual<{
  act(callback: () => Promise<void> | void): Promise<void>;
  create(element: ReactElement): ReactTestRenderer;
}>('react-test-renderer');

const schoolsApi = jest.requireMock('../api/schools') as { getSchool: jest.Mock; updateSchool: jest.Mock };

const school: School = {
  id: 'school-1',
  name: 'Sunrise School',
  address: '12 Lake Road',
  city: 'Indore',
  state: 'MP',
  pincode: '452001',
  contactEmail: null,
  contactPhone: '9876543210',
  principalName: 'A. Sharma',
  directorName: null,
  bankAccountNumber: '123456789012',
  bankIfsc: 'SBIN0001234',
  bankAccountHolderName: null,
  upiVpaOverride: 'sunrise@oksbi',
  latitude: null,
  longitude: null,
  geofenceRadiusMeters: 100,
  logoUrl: null,
  studentCount: 0,
  classSectionCount: 0,
  teacherCount: 0,
  board: 'CBSE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const navigation = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}) };

function texts(tree: ReactTestRenderer): string[] {
  const flat = (value: unknown): string =>
    Array.isArray(value) ? value.map(flat).join('') : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return tree.root.findAllByType(Text).map((node) => flat(node.props.children));
}

function press(node: ReactTestInstance) {
  (node.props.onPress as () => void)();
}

async function renderScreen(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SchoolContext.Provider value="school-1">
        <SchoolBoardSettingsScreen navigation={navigation as never} route={{ key: 'k', name: 'SchoolBoardSettings', params: undefined } as never} />
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
  schoolsApi.getSchool.mockResolvedValue(school);
});

jest.setTimeout(20000);

describe('SchoolBoardSettingsScreen', () => {
  it('shows the school board selected and keeps Save off until it changes', async () => {
    const tree = await renderScreen();

    expect(texts(tree)).toContain(en.schoolBoard.options.CBSE.title);
    expect(tree.root.findByProps({ testID: 'school-board-option-CBSE' }).props.accessibilityState).toEqual({ checked: true, disabled: false });
    expect(tree.root.findByProps({ testID: 'school-board-save' }).props.disabled).toBe(true);
  });

  it('an older server with no board reads as CBSE', async () => {
    schoolsApi.getSchool.mockResolvedValue({ ...school, board: undefined });
    const tree = await renderScreen();
    expect(tree.root.findByProps({ testID: 'school-board-option-CBSE' }).props.accessibilityState).toEqual({ checked: true, disabled: false });
  });

  it('saving sends the whole profile back with the new board, so nothing else is wiped', async () => {
    schoolsApi.updateSchool.mockResolvedValue({ ...school, board: 'ICSE' });
    const tree = await renderScreen();

    await act(async () => {
      press(tree.root.findByProps({ testID: 'school-board-option-ICSE' }));
    });
    expect(tree.root.findByProps({ testID: 'school-board-save' }).props.disabled).toBe(false);
    await act(async () => {
      press(tree.root.findByProps({ testID: 'school-board-save' }));
    });

    expect(schoolsApi.updateSchool).toHaveBeenCalledWith('school-1', {
      name: 'Sunrise School',
      address: '12 Lake Road',
      city: 'Indore',
      state: 'MP',
      pincode: '452001',
      contactEmail: null,
      contactPhone: '9876543210',
      principalName: 'A. Sharma',
      directorName: null,
      bankAccountNumber: '123456789012',
      bankIfsc: 'SBIN0001234',
      bankAccountHolderName: undefined,
      upiVpaOverride: 'sunrise@oksbi',
      board: 'ICSE',
    });
    expect(mockShowToast).toHaveBeenCalledWith('Board set to ICSE', 'success');
    expect(tree.root.findByProps({ testID: 'school-board-save' }).props.disabled).toBe(true);
  });

  it('a failed save shows the error and keeps the choice', async () => {
    schoolsApi.updateSchool.mockRejectedValue(new Error('Forbidden'));
    const tree = await renderScreen();

    await act(async () => {
      press(tree.root.findByProps({ testID: 'school-board-option-ICSE' }));
    });
    await act(async () => {
      press(tree.root.findByProps({ testID: 'school-board-save' }));
    });

    expect(mockShowToast).toHaveBeenCalledWith('Forbidden', 'error');
    expect(tree.root.findByProps({ testID: 'school-board-option-ICSE' }).props.accessibilityState).toEqual({ checked: true, disabled: false });
  });
});
