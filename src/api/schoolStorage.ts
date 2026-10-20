import AsyncStorage from '@react-native-async-storage/async-storage';

const SCHOOL_ID_KEY = 'gurukul.schoolId';

export function getStoredSchoolId() {
  return AsyncStorage.getItem(SCHOOL_ID_KEY);
}

export function setStoredSchoolId(schoolId: string) {
  return AsyncStorage.setItem(SCHOOL_ID_KEY, schoolId);
}

export function clearStoredSchoolId() {
  return AsyncStorage.removeItem(SCHOOL_ID_KEY);
}
