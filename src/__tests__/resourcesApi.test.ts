import { api, setAuthSession } from '../api/client';
import { getCurriculumSuggestions, setSubjectCurriculum } from '../api/curriculumMapping';
import { getSectionResources, setChapterHidden } from '../api/resources';
import type { LoginResponse } from '../api/types';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn(() => Promise.resolve()) }));

const HOUR = 60 * 60 * 1000;

function session(): LoginResponse {
  return {
    token: 'access-1',
    tokenType: 'Bearer',
    ownerType: 'STUDENT',
    ownerId: 'student-1',
    role: 'STUDENT',
    schoolId: 'school-1',
    username: 'riya',
    refreshToken: 'refresh-1',
    accessTokenExpiresAt: new Date(Date.now() + HOUR).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * HOUR).toISOString(),
  } as LoginResponse;
}

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };
let calls: Call[];

beforeEach(() => {
  calls = [];
  globalThis.fetch = jest.fn(async (url: string, init: any) => {
    calls.push({ url, method: init.method, headers: { ...(init.headers ?? {}) }, body: init.body ? JSON.parse(init.body) : undefined });
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve({ success: true, data: { ok: true } }),
    };
  }) as any;
  setAuthSession(session());
});

afterEach(() => setAuthSession(null));

describe('Resource Hub API paths', () => {
  it('reads a section\'s resources scoped to the school', async () => {
    await getSectionResources('school-1', 'sec-9');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/v1\/class-sections\/sec-9\/resources$/);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].headers).toEqual(expect.objectContaining({ 'X-School-Id': 'school-1', Authorization: 'Bearer access-1' }));
  });

  it('hides a chapter with a PATCH on the school\'s syllabus row', async () => {
    await setChapterHidden('school-1', 'sc-2', true);
    expect(calls[0].url).toMatch(/\/api\/v1\/gamification\/syllabus\/chapters\/sc-2$/);
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].body).toEqual({ hidden: true });
  });

  it('asks for suggestions and links a subject, sending null to unlink', async () => {
    await getCurriculumSuggestions('school-1', 'sub-1');
    await setSubjectCurriculum('school-1', 'sub-1', 'mathematics');
    await setSubjectCurriculum('school-1', 'sub-1', null);
    expect(calls.map((c) => `${c.method} ${c.url.replace(/^.*\/api/, '/api')}`)).toEqual([
      'GET /api/v1/subjects/sub-1/curriculum-suggestions',
      'PUT /api/v1/subjects/sub-1/curriculum',
      'PUT /api/v1/subjects/sub-1/curriculum',
    ]);
    expect(calls[1].body).toEqual({ curriculumSubjectKey: 'mathematics' });
    expect(calls[2].body).toEqual({ curriculumSubjectKey: null });
  });

  it('keeps the plain api client untouched for other calls', async () => {
    await api.get('/api/v1/subjects', 'school-1');
    expect(calls[0].method).toBe('GET');
  });
});
