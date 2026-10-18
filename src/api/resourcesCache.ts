import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SectionResources } from './types';
import { resourcesCacheKey } from '../utils/resources';

/**
 * The last Resources payload per section, so the chapter and topic list still reads offline. Best
 * effort both ways: a missing or unreadable cache is just "nothing cached".
 */
export async function readCachedResources(schoolId: string, sectionId: string): Promise<SectionResources | null> {
  try {
    const raw = await AsyncStorage.getItem(resourcesCacheKey(schoolId, sectionId));
    return raw ? (JSON.parse(raw) as SectionResources) : null;
  } catch {
    return null;
  }
}

export async function writeCachedResources(schoolId: string, sectionId: string, data: SectionResources): Promise<void> {
  try {
    await AsyncStorage.setItem(resourcesCacheKey(schoolId, sectionId), JSON.stringify(data));
  } catch {
    // Storage full or unavailable: the screen still works from the network.
  }
}
