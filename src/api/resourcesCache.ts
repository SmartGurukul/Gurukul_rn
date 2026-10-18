import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SectionResources } from './types';
import { lastOpenedKey, resourcesCacheKey } from '../utils/resources';

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

/** The chapter a student last opened in one subject, which the journey shows as the current step. */
export async function readLastOpened(schoolId: string, sectionId: string, subjectId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(lastOpenedKey(schoolId, sectionId, subjectId));
  } catch {
    return null;
  }
}

export async function writeLastOpened(schoolId: string, sectionId: string, subjectId: string, chapterId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(lastOpenedKey(schoolId, sectionId, subjectId), chapterId);
  } catch {
    // Not remembered this time; the journey falls back to the first chapter with a video.
  }
}
