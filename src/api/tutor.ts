import { api } from './client';
import type {
  TutorAccess,
  TutorChaptersResponse,
  TutorQuizAnswersRequest,
  TutorQuizResult,
  TutorQuizWeekly,
  TutorReport,
  TutorSessionList,
  TutorSessionView,
  TutorTranscription,
  TutorTurnResult,
} from './types';

/** AI Tutor (workspace specs/ai-tutor-preview/contract.md). All routes are school-scoped. */

export function getMyTutorAccess(schoolId: string) {
  return api.get<TutorAccess>('/api/v1/tutor/me/access', schoolId);
}

export function getStudentTutorAccess(schoolId: string, studentId: string) {
  return api.get<TutorAccess>(`/api/v1/tutor/students/${studentId}/access`, schoolId);
}

export function getTutorChapters(schoolId: string) {
  return api.get<TutorChaptersResponse>('/api/v1/tutor/chapters', schoolId);
}

export function startTutorSession(schoolId: string, chapterId: string, mode: 'TEXT' | 'VOICE') {
  return api.post<TutorSessionView>('/api/v1/tutor/sessions', { chapterId, mode }, schoolId);
}

export function sendTutorTurn(schoolId: string, sessionId: string, content: string) {
  return api.post<TutorTurnResult>(`/api/v1/tutor/sessions/${sessionId}/turns`, { content }, schoolId);
}

export function closeTutorSession(schoolId: string, sessionId: string) {
  return api.post<TutorSessionView>(`/api/v1/tutor/sessions/${sessionId}/close`, {}, schoolId);
}

export function getTutorSession(schoolId: string, sessionId: string) {
  return api.get<TutorSessionView>(`/api/v1/tutor/sessions/${sessionId}`, schoolId);
}

/** The signed-in student's sessions, or a child's / any student's for a parent or admin. */
export function listTutorSessions(schoolId: string, studentId?: string) {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
  return api.get<TutorSessionList>(`/api/v1/tutor/sessions${query}`, schoolId);
}

export function getTutorReport(schoolId: string, studentId: string) {
  return api.get<TutorReport>(`/api/v1/tutor/students/${studentId}/report`, schoolId);
}

export function getWeeklyTutorQuiz(schoolId: string) {
  return api.get<TutorQuizWeekly>('/api/v1/tutor/quiz/weekly', schoolId);
}

export function answerWeeklyTutorQuiz(schoolId: string, req: TutorQuizAnswersRequest) {
  return api.post<TutorQuizResult>('/api/v1/tutor/quiz/weekly/answers', req, schoolId);
}

/**
 * Voice input: the recorded clip goes to the server's speech-to-text. A 503 with errorCode
 * TUTOR_STT_UNAVAILABLE means no speech provider is configured; the screen falls back to typing.
 */
export function transcribeTutorAudio(schoolId: string, file: { uri: string; name: string; type: string }) {
  const form = new FormData();
  form.append('audio', file as unknown as Blob);
  return api.post<TutorTranscription>('/api/v1/tutor/transcribe', form, schoolId);
}
