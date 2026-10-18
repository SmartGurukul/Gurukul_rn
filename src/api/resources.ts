import { api } from './client';
import type { SectionResources, SyllabusChapterHidden } from './types';

/** Everything the Resources screen shows for one class section, scoped by role on the server. */
export function getSectionResources(schoolId: string, sectionId: string) {
  return api.get<SectionResources>(`/api/v1/class-sections/${sectionId}/resources`, schoolId);
}

/** Teacher of that subject and class, or admin: hide a chapter the school does not teach, or show it again. */
export function setChapterHidden(schoolId: string, syllabusChapterId: string, hidden: boolean) {
  return api.patch<SyllabusChapterHidden>(`/api/v1/gamification/syllabus/chapters/${syllabusChapterId}`, { hidden }, schoolId);
}
