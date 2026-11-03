import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * What the app knows about push on this phone: the notification permission, the Expo push token,
 * and how the last registration with our backend went. usePushNotifications writes it; the
 * notifications-off banner and the push debug screen read it; logout reads the token so the
 * backend can unbind this phone.
 */
export interface PushStatus {
  permission: { status: Notifications.PermissionStatus; canAskAgain: boolean } | null;
  /** False in Expo Go and on emulators/simulators, where no push token can exist at all. */
  supported: boolean;
  expoPushToken: string | null;
  tokenError: string | null;
  lastRegistration: { at: string; ok: boolean; error?: string } | null;
}

const EXPO_PUSH_TOKEN_KEY = 'gurukul.expoPushToken';

let status: PushStatus = {
  permission: null,
  // No push on the web app (smartgurukul.org/app): Expo push tokens are phone-only.
  supported: Platform.OS !== 'web' && Device.isDevice && Constants.appOwnership !== 'expo',
  expoPushToken: null,
  tokenError: null,
  lastRegistration: null,
};
const listeners = new Set<() => void>();

export function updatePushStatus(patch: Partial<PushStatus>) {
  status = { ...status, ...patch };
  if (patch.expoPushToken) AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, patch.expoPushToken).catch(() => {});
  listeners.forEach((listener) => listener());
}

export function getPushStatus() {
  return status;
}

export function usePushStatus(): PushStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getPushStatus
  );
}

/**
 * The token this phone last registered, for logout to unbind. Falls back to the one saved on an
 * earlier launch, in case this launch's token fetch hasn't finished (or failed) - the phone may
 * still be bound from before.
 */
export async function getLastExpoPushToken(): Promise<string | null> {
  return status.expoPushToken ?? (await AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY).catch(() => null));
}

/** After logout: forget the token and registration, so the next login starts clean. */
export function clearPushRegistration() {
  AsyncStorage.removeItem(EXPO_PUSH_TOKEN_KEY).catch(() => {});
  status = { ...status, expoPushToken: null, lastRegistration: null, tokenError: null };
  listeners.forEach((listener) => listener());
}

export async function refreshPushPermission() {
  const { status: permissionStatus, canAskAgain } = await Notifications.getPermissionsAsync();
  updatePushStatus({ permission: { status: permissionStatus, canAskAgain } });
  return permissionStatus;
}

// Set by usePushNotifications while someone is signed in: fetches the token and registers it.
let registerHandler: (() => Promise<void>) | null = null;

export function setPushRegisterHandler(handler: (() => Promise<void>) | null) {
  registerHandler = handler;
}

/** Registers again now, if permission allows (the debug screen's "Register again"). */
export async function registerPushNow() {
  if ((await refreshPushPermission()) === 'granted') await registerHandler?.();
}

/**
 * Shows the system permission prompt - called from the explanation card, never on its own, since
 * a first prompt the user understands gets allowed far more often. Registers right away if allowed.
 */
export async function requestPushPermission() {
  const { status: permissionStatus, canAskAgain } = await Notifications.requestPermissionsAsync();
  updatePushStatus({ permission: { status: permissionStatus, canAskAgain } });
  if (permissionStatus === 'granted') await registerHandler?.();
}
