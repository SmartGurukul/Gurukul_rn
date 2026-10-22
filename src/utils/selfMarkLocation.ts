import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { LocationIntegrity, type DeviceChecks } from '../../modules/location-integrity';
import type { SelfMarkAttendanceRequest } from '../api/types';

/** Shown to the user, and the reason self-marking stops before anything is sent. */
export class SelfMarkLocationError extends Error {}

export const MOCKED_LOCATION_MESSAGE =
  'Your phone is using a fake (mock) location. Turn off any fake GPS app and try again.';

/**
 * Why these device checks rule out self-marking, or null when they're clean. A missing native
 * module means an app build from before these checks, which can't prove anything about the phone.
 */
export function deviceCheckProblem(checks: DeviceChecks | null): string | null {
  if (!checks) {
    return 'This version of the app can’t verify your location. Update Smart Gurukul and try again.';
  }
  if (checks.appCloned) {
    return 'Smart Gurukul is running inside a cloner app (like Parallel Space or Dual Space). Open it directly from your home screen and try again.';
  }
  if (checks.rooted) {
    return 'Attendance can’t be self-marked from a rooted or jailbroken phone, because the location can be faked. Ask an admin to mark it for you.';
  }
  if (checks.developerOptionsEnabled) {
    return 'Turn off Developer options in your phone’s Settings, then try again. Fake GPS apps work through Developer options, so check-in is blocked while they’re on.';
  }
  return null;
}

/**
 * Expo Go can't load the native module, so the fake-GPS device checks can't run there. The check-in is
 * sent without them, and the server accepts it only for a school that allows unverified phones (the
 * JNV demo school); every other school refuses it with "Update Smart Gurukul".
 */
export function skipsDeviceChecks(): boolean {
  return !LocationIntegrity && Constants.appOwnership === 'expo';
}

/**
 * Takes a fresh fix plus the device checks, refusing anything that could be faked. The server
 * repeats every check, so this is for a clear message, not the security boundary.
 */
export async function readSelfMarkLocation(): Promise<SelfMarkAttendanceRequest> {
  const deviceChecks = LocationIntegrity?.getDeviceChecks() ?? null;
  if (deviceChecks || !skipsDeviceChecks()) {
    const problem = deviceCheckProblem(deviceChecks);
    if (problem) {
      throw new SelfMarkLocationError(problem);
    }
  }

  let fix: { latitude: number; longitude: number; accuracy?: number; timestamp: number; mocked: boolean };
  if (Platform.OS === 'ios' && LocationIntegrity?.getCurrentFix) {
    // expo-location never reports mock locations on iOS; the native reading does.
    fix = await LocationIntegrity.getCurrentFix();
  } else {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    fix = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? undefined,
      timestamp: position.timestamp,
      mocked: position.mocked ?? false,
    };
  }
  if (fix.mocked) {
    throw new SelfMarkLocationError(MOCKED_LOCATION_MESSAGE);
  }

  return {
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    mocked: fix.mocked,
    fixTimestamp: fix.timestamp,
    deviceChecks: deviceChecks ?? undefined,
  };
}
