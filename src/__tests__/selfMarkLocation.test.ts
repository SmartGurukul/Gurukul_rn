import * as Location from 'expo-location';

import { LocationIntegrity } from '../../modules/location-integrity';
import { deviceCheckProblem, readSelfMarkLocation, SelfMarkLocationError, skipsDeviceChecks } from '../utils/selfMarkLocation';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getCurrentPositionAsync: jest.fn(),
}));
// A `null` module is Expo Go (or an old build); the tests put the real one back where they need it.
const mockNativeModule = { current: { getDeviceChecks: jest.fn() } as { getDeviceChecks: jest.Mock } | null };
jest.mock('../../modules/location-integrity', () => ({
  get LocationIntegrity() {
    return mockNativeModule.current;
  },
}));
// The factory runs when selfMarkLocation imports expo-constants (hoisted above this file's consts), so
// the object lives inside it and is read back here.
jest.mock('expo-constants', () => ({ __esModule: true, default: { appOwnership: null } }));
const mockConstants = (jest.requireMock('expo-constants') as { default: { appOwnership: string | null } }).default;

const clean = { developerOptionsEnabled: false, rooted: false, appCloned: false };
const getDeviceChecks = LocationIntegrity!.getDeviceChecks as jest.Mock;
const getCurrentPositionAsync = Location.getCurrentPositionAsync as jest.Mock;

function position(mocked: boolean | undefined) {
  return { coords: { latitude: 26.9, longitude: 75.8, accuracy: 12 }, timestamp: 1000, mocked };
}

beforeEach(() => {
  jest.clearAllMocks();
  getDeviceChecks.mockReturnValue(clean);
  getCurrentPositionAsync.mockResolvedValue(position(false));
});

describe('deviceCheckProblem', () => {
  it('passes a clean phone', () => {
    expect(deviceCheckProblem(clean)).toBeNull();
  });

  it.each([
    ['developerOptionsEnabled', /Developer options/],
    ['rooted', /rooted/],
    ['appCloned', /cloner app/],
  ])('refuses %s', (flag, message) => {
    expect(deviceCheckProblem({ ...clean, [flag]: true })).toMatch(message);
  });

  it('refuses an app build without the native checks', () => {
    expect(deviceCheckProblem(null)).toMatch(/Update Smart Gurukul/);
  });
});

describe('readSelfMarkLocation', () => {
  it('sends the fix with the device checks', async () => {
    await expect(readSelfMarkLocation()).resolves.toEqual({
      latitude: 26.9,
      longitude: 75.8,
      accuracy: 12,
      mocked: false,
      fixTimestamp: 1000,
      deviceChecks: clean,
    });
  });

  it('never reads the location when a fake GPS app could be active', async () => {
    getDeviceChecks.mockReturnValue({ ...clean, developerOptionsEnabled: true });
    await expect(readSelfMarkLocation()).rejects.toBeInstanceOf(SelfMarkLocationError);
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('refuses a fix the OS marks as mocked', async () => {
    getCurrentPositionAsync.mockResolvedValue(position(true));
    await expect(readSelfMarkLocation()).rejects.toThrow(/fake \(mock\) location/);
  });
});

describe('without the native module', () => {
  const realModule = mockNativeModule.current;

  beforeEach(() => {
    mockNativeModule.current = null;
  });

  afterEach(() => {
    mockNativeModule.current = realModule;
    mockConstants.appOwnership = null;
  });

  it('is an old build outside Expo Go: refuses before reading the location', async () => {
    expect(skipsDeviceChecks()).toBe(false);
    await expect(readSelfMarkLocation()).rejects.toThrow(/Update Smart Gurukul/);
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('in Expo Go sends the fix without device checks, for the server to decide', async () => {
    mockConstants.appOwnership = 'expo';
    expect(skipsDeviceChecks()).toBe(true);
    await expect(readSelfMarkLocation()).resolves.toEqual({
      latitude: 26.9,
      longitude: 75.8,
      accuracy: 12,
      mocked: false,
      fixTimestamp: 1000,
      deviceChecks: undefined,
    });
  });

  it('in Expo Go still refuses a mocked fix', async () => {
    mockConstants.appOwnership = 'expo';
    getCurrentPositionAsync.mockResolvedValue(position(true));
    await expect(readSelfMarkLocation()).rejects.toThrow(/fake \(mock\) location/);
  });

  it('never skips the checks when the module is there', () => {
    mockNativeModule.current = realModule;
    mockConstants.appOwnership = 'expo';
    expect(skipsDeviceChecks()).toBe(false);
  });
});
