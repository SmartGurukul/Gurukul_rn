import { api } from './client';
import type { CurriculumSuggestions, SubjectCurriculumResult } from './types';

/** Admin: the current link and the best NCERT-subject guesses for one school subject. */
export function getCurriculumSuggestions(schoolId: string, subjectId: string) {
  return api.get<CurriculumSuggestions>(`/api/v1/subjects/${subjectId}/curriculum-suggestions`, schoolId);
}

/**
 * Admin: link a school subject to an NCERT subject (null unlinks it). The server pre-fills the
 * school's chapter list for every class that has this subject and reports how many it added.
 */
export function setSubjectCurriculum(schoolId: string, subjectId: string, curriculumSubjectKey: string | null) {
  return api.put<SubjectCurriculumResult>(`/api/v1/subjects/${subjectId}/curriculum`, { curriculumSubjectKey }, schoolId);
}
