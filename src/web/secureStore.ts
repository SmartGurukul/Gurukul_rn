/**
 * Web stand-in for expo-secure-store (whose web build is an empty module). The browser has no
 * keychain, so values live in localStorage under a prefix - the same place AsyncStorage already
 * keeps the rest of the session on web. Wired in for web builds only, by metro.config.js.
 */
const PREFIX = 'securestore.';

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  return storage()?.getItem(PREFIX + key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  storage()?.setItem(PREFIX + key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  storage()?.removeItem(PREFIX + key);
}

export async function isAvailableAsync(): Promise<boolean> {
  return storage() !== null;
}
