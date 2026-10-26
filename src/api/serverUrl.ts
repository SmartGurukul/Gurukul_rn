import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { BASE_URL, getBaseUrl, setBaseUrlOverride } from './client';

const KEY = 'gurukul.serverUrlOverride';

/**
 * The Server screen is for preview bundles only: Expo Go on the `main` channel or any preview
 * channel, and dev builds. A store build never shows it and never reads an override.
 */
export function canOverrideServer(): boolean {
  if (__DEV__) return true;
  return Constants.appOwnership === 'expo';
}

/** Applies a saved override before the first request; call once at app start. */
export async function loadServerUrlOverride(): Promise<string | null> {
  if (!canOverrideServer()) return null;
  try {
    const saved = await AsyncStorage.getItem(KEY);
    setBaseUrlOverride(saved);
    return saved;
  } catch {
    return null;
  }
}

/** Saves and applies the override; an empty string clears it (back to the production server). */
export async function saveServerUrlOverride(url: string): Promise<void> {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed && !/^https?:\/\/[^\s/]+(:\d+)?$/.test(trimmed)) {
    throw new Error('Enter the server as http://<laptop-ip>:8080 or https://host');
  }
  try {
    if (trimmed) await AsyncStorage.setItem(KEY, trimmed);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable in previews; the override still applies for this launch.
  }
  setBaseUrlOverride(trimmed || null);
}

export function currentServerUrl(): string {
  return getBaseUrl();
}

export function defaultServerUrl(): string {
  return BASE_URL;
}
