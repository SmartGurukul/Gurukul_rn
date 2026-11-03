// School Suite API layer. Same contract as the app's src/api/client.ts: every call carries
// Authorization: Bearer <access token> and X-School-Id; a 401 tries one refresh, then signs out.
// Responses are the backend's ApiResponse envelope {success, data, message, errorCode}; `data` is
// returned, the rest raised as ApiError.

const PROD = 'https://api.smartgurukul.org';
const SESSION_KEY = 'sg.suite.session';
const SERVER_KEY = 'sg.suite.server';

export class ApiError extends Error {
  constructor(status, message, errorCode, data) {
    super(message || `HTTP ${status}`);
    this.status = status;
    this.errorCode = errorCode || null;
    this.data = data;
  }
}

export function baseUrl() {
  try {
    const o = localStorage.getItem(SERVER_KEY);
    if (o) return o.replace(/\/+$/, '');
  } catch { /* storage blocked */ }
  return PROD;
}

export function setBaseUrl(url) {
  try {
    if (url) localStorage.setItem(SERVER_KEY, url); else localStorage.removeItem(SERVER_KEY);
  } catch { /* ignore */ }
}

let session = null;
try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { session = null; }

export function getSession() { return session; }

export function setSession(next) {
  session = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next)); else localStorage.removeItem(SESSION_KEY);
  } catch { /* storage blocked: the session lives for this page only */ }
}

const signOutListeners = new Set();
export function onSignedOut(fn) { signOutListeners.add(fn); return () => signOutListeners.delete(fn); }

export async function signOut(tellServer = true) {
  const s = session;
  setSession(null);
  if (tellServer && s?.refreshToken) {
    try {
      await fetch(`${baseUrl()}/api/v1/auth/logout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: s.refreshToken }),
      });
    } catch { /* best effort */ }
  }
  signOutListeners.forEach((fn) => fn());
}

let refreshing = null;
async function refreshAccessToken() {
  if (!session?.refreshToken) return false;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await fetch(`${baseUrl()}/api/v1/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success || !body.data?.token) return false;
      setSession({ ...session, ...body.data });
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * Low-level request. `schoolId` null = no X-School-Id (the few exempt auth routes). `auth` false =
 * no bearer token (login routes). Returns the envelope's `data`.
 */
export async function request(method, path, { body, schoolId, auth = true, retry = true, raw = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && session?.token) headers.Authorization = `Bearer ${session.token}`;
  if (schoolId) headers['X-School-Id'] = schoolId;
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new ApiError(0, 'Could not reach the server. Check your internet connection.', 'NETWORK');
  }
  if (res.status === 401 && auth && retry && session) {
    if (await refreshAccessToken()) return request(method, path, { body, schoolId, auth, retry: false, raw });
    await signOut(false);
    throw new ApiError(401, 'Your session ended. Please sign in again.', 'SESSION_EXPIRED');
  }
  if (raw) return res;
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError(res.status, json?.message || `Request failed (HTTP ${res.status})`, json?.errorCode, json?.data);
  }
  return json && 'data' in json ? json.data : json;
}

export const api = {
  get: (path, schoolId, opts) => request('GET', path, { schoolId, ...opts }),
  post: (path, body, schoolId, opts) => request('POST', path, { body: body ?? {}, schoolId, ...opts }),
  put: (path, body, schoolId, opts) => request('PUT', path, { body, schoolId, ...opts }),
  patch: (path, body, schoolId, opts) => request('PATCH', path, { body, schoolId, ...opts }),
  delete: (path, schoolId, opts) => request('DELETE', path, { schoolId, ...opts }),
};

// ---- auth -------------------------------------------------------------------------------------
export const PUBLIC_SCHOOL_ID = '11111111-1111-4111-8111-111111111111';

export function lookupSchoolsByPhone(phone) {
  return request('POST', '/api/v1/auth/phone/schools', { body: { phone }, auth: false });
}
export function searchSchools(name) {
  return request('GET', `/api/v1/schools?name=${encodeURIComponent(name)}`, { auth: false });
}
export function requestOtp(schoolId, phone) {
  return request('POST', '/api/v1/auth/otp/request', { body: { phone }, schoolId, auth: false });
}
export function verifyOtp(schoolId, phone, otp) {
  return request('POST', '/api/v1/auth/otp/verify', { body: { phone, otp }, schoolId, auth: false });
}
export function selectProfile(schoolId, selectionToken, ownerType, ownerId) {
  return request('POST', '/api/v1/auth/otp/select-profile', { body: { selectionToken, ownerType, ownerId }, schoolId, auth: false });
}
export function login(schoolId, username, password) {
  return request('POST', '/api/v1/auth/login', { body: { username, password }, schoolId, auth: false });
}
export function listProfiles(schoolId) { return api.get('/api/v1/auth/profiles', schoolId); }
export function getSchool(schoolId) { return api.get(`/api/v1/schools/${schoolId}`, schoolId); }

// ---- mail ---------------------------------------------------------------------------------------
export function listConversations(s) { return api.get('/api/v1/chat/conversations', s); }
export function listChatContacts(s) { return api.get('/api/v1/chat/contacts', s); }
export function createConversation(s, otherPartyOwnerType, otherPartyOwnerId) {
  return api.post('/api/v1/chat/conversations', { otherPartyOwnerType, otherPartyOwnerId }, s);
}
export function getMessages(s, conversationId, page = 0) {
  return api.get(`/api/v1/chat/conversations/${conversationId}/messages?page=${page}&size=50`, s);
}
export function markConversationRead(s, conversationId) { return api.post(`/api/v1/chat/conversations/${conversationId}/read`, {}, s); }
export function getChatUnreadCount(s) { return api.get('/api/v1/chat/unread-count', s); }
export function presignChatAttachment(s, conversationId, req) {
  return api.post(`/api/v1/chat/conversations/${conversationId}/attachments/presign`, req, s);
}
export function listAnnouncements(s) { return api.get('/api/v1/chat/announcements', s); }
export function createAnnouncement(s, req) { return api.post('/api/v1/chat/announcements', req, s); }
export function listNotifications(s, page = 0) { return api.get(`/api/v1/notifications?page=${page}&size=30`, s); }
export function markNotificationRead(s, id) { return api.post(`/api/v1/notifications/${id}/read`, {}, s); }
export function markAllNotificationsRead(s) { return api.post('/api/v1/notifications/read-all', {}, s); }

// ---- calendar -----------------------------------------------------------------------------------
export function listHolidays(s, from, to) {
  const q = from && to ? `?from=${from}&to=${to}` : '';
  return api.get(`/api/v1/holidays${q}`, s);
}
export function listEvents(s) { return api.get('/api/v1/events', s); }
export function getEvent(s, id) { return api.get(`/api/v1/events/${id}`, s); }
export function rsvpEvent(s, id, status) { return api.post(`/api/v1/events/${id}/rsvp`, { status }, s); }
export function myTimetable(s, date, childId) {
  const p = new URLSearchParams();
  if (date) p.set('date', date);
  if (childId) p.set('childId', childId);
  const q = p.toString();
  return api.get(`/api/v1/timetable/me${q ? `?${q}` : ''}`, s);
}
export function listPeriods(s) { return api.get('/api/v1/periods', s); }
export function listHostedCalls(s) { return api.get('/api/v1/calls/scheduled/hosted', s); }
export function listInvitedCalls(s) { return api.get('/api/v1/calls/scheduled/invited', s); }
export function myChildren(s) { return api.get('/api/v1/parents/me/children', s); }
export function listAcademicTerms(s) { return api.get('/api/v1/academic-terms', s); }
export function listSectionAssessments(s, sectionId) { return api.get(`/api/v1/class-sections/${sectionId}/assessments`, s); }

// ---- drive ----------------------------------------------------------------------------------------
export function listClassSections(s) { return api.get('/api/v1/class-sections', s); }
export function getSectionResources(s, sectionId) { return api.get(`/api/v1/class-sections/${sectionId}/resources`, s); }

/** PUT raw bytes to a presigned S3 URL (same Content-Type the presign declared). */
export async function putToPresignedUrl(uploadUrl, file, contentType) {
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
  if (!res.ok) throw new ApiError(res.status, `Upload to storage failed (HTTP ${res.status})`);
}

// ---- live (STOMP over WebSocket, same endpoint as the app) --------------------------------------
let stomp = null;
let stompConnecting = null;
const subs = new Map();

export function liveClient(schoolId) {
  if (stomp?.active && stomp.connected) return Promise.resolve(stomp);
  if (stompConnecting) return stompConnecting;
  if (!window.StompJs) return Promise.reject(new Error('live library not loaded'));
  stompConnecting = new Promise((resolve, reject) => {
    const client = new window.StompJs.Client({
      brokerURL: baseUrl().replace(/^http/, 'ws') + '/ws/websocket',
      reconnectDelay: 5000,
      beforeConnect: () => {
        client.connectHeaders = { Authorization: `Bearer ${session?.token ?? ''}`, 'X-School-Id': schoolId };
      },
      onConnect: () => {
        subs.forEach((cb, dest) => client.subscribe(dest, (frame) => cb(JSON.parse(frame.body))));
        stomp = client;
        stompConnecting = null;
        resolve(client);
      },
      onStompError: (f) => { stompConnecting = null; reject(new Error(f.headers?.message || 'live connection refused')); },
      onWebSocketError: () => { if (stompConnecting) { stompConnecting = null; reject(new Error('live connection failed')); } },
    });
    client.activate();
  });
  return stompConnecting;
}

/** Subscribe to a topic; the callback gets the parsed frame body. Returns an unsubscribe fn. */
export async function liveSubscribe(schoolId, destination, cb) {
  subs.set(destination, cb);
  const client = await liveClient(schoolId);
  const sub = client.subscribe(destination, (frame) => cb(JSON.parse(frame.body)));
  return () => { subs.delete(destination); try { sub.unsubscribe(); } catch { /* gone */ } };
}

export async function liveSend(schoolId, destination, body) {
  const client = await liveClient(schoolId);
  client.publish({ destination, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

export function liveDisconnect() {
  subs.clear();
  if (stomp) { try { stomp.deactivate(); } catch { /* ignore */ } }
  stomp = null; stompConnecting = null;
}
