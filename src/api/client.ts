import { setStoredSession } from './authStorage';
import type { ApiResponse, LoginResponse, PagedResponse } from './types';

// Production by default. Set EXPO_PUBLIC_API_BASE_URL in .env (gitignored) to point a dev build at
// a local backend - note that from an Android emulator the host machine is 10.0.2.2, not localhost,
// and from a physical device it's your machine's LAN IP. EXPO_PUBLIC_* values are inlined at bundle
// time, so changing .env needs Metro restarted with a cleared cache to take effect.
export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.smartgurukul.org';

// A runtime override of the server, for preview bundles that must talk to a laptop's backend (the
// AI Tutor preview, workspace specs/ai-tutor-preview). Set from the Server screen and kept in
// AsyncStorage by src/api/serverUrl.ts; empty means BASE_URL. Never set in production bundles.
let baseUrlOverride: string | null = null;

export function setBaseUrlOverride(url: string | null) {
  baseUrlOverride = url && url.trim() ? url.trim().replace(/\/+$/, '') : null;
}

export function getBaseUrl(): string {
  return baseUrlOverride ?? BASE_URL;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    /** The server's stable machine-readable code for specific cases (e.g. 'TIMETABLE_CLASH'). */
    public errorCode?: string,
    /** Structured error details some endpoints send alongside the message (e.g. clashing slots). */
    public data?: unknown
  ) {
    super(message);
  }
}

let currentSession: LoginResponse | null = null;
// Bumped whenever the session is replaced from outside a refresh (login, logout, profile switch),
// so a refresh that was already in flight can tell its result belongs to a session that's gone.
let sessionGeneration = 0;

/** Sets (or clears, with null) the session every request authenticates as. */
export function setAuthSession(session: LoginResponse | null) {
  if (session?.token !== currentSession?.token) sessionGeneration += 1;
  currentSession = session;
}

/** For requests made outside `api` (e.g. file downloads, sockets) that still need the bearer token. */
export function getAuthToken(): string | null {
  return currentSession?.token ?? null;
}

export function getRefreshToken(): string | null {
  return currentSession?.refreshToken ?? null;
}

let sessionRefreshedListener: ((session: LoginResponse) => void) | null = null;
let sessionExpiredListener: (() => void) | null = null;

/** App.tsx subscribes so its session state follows each silent refresh. */
export function onSessionRefreshed(listener: ((session: LoginResponse) => void) | null) {
  sessionRefreshedListener = listener;
}

/** Called when the session can't be renewed any more (refresh rejected, or a legacy session's 401). */
export function onSessionExpired(listener: (() => void) | null) {
  sessionExpiredListener = listener;
}

/**
 * The request never got an answer: no connection, or the server took longer than the timeout.
 * Not an ApiError - the server said nothing - so screens can offer "try again" rather than
 * treating it as a rejection. Turn it into words with getErrorMessage (src/api/errorMessage.ts).
 */
export class NetworkError extends Error {
  constructor(public reason: 'offline' | 'timeout') {
    super(reason === 'timeout' ? 'The server took too long to respond' : 'No internet connection');
  }
}

export const DEFAULT_TIMEOUT_MS = 30 * 1000;
/** For requests that do real work before answering: AI replies, generating fees or report cards. */
export const SLOW_TIMEOUT_MS = 2 * 60 * 1000;

/** fetch, but it gives up after `timeoutMs` and reports failures as NetworkError. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new NetworkError(controller.signal.aborted ? 'timeout' : 'offline');
  } finally {
    clearTimeout(timer);
  }
}

/** A request that failed because the session is over - the user is being sent back to login. */
export class SessionExpiredError extends ApiError {
  constructor() {
    super('Your session expired, please log in again.', 401);
  }
}

const REFRESH_PATH = '/api/v1/auth/refresh';
const LOGOUT_PATH = '/api/v1/auth/logout';
// Endpoints that hand out or end sessions - a 401 from these means wrong credentials or a bad code,
// not an expired access token, so refreshing and retrying would be wrong.
const NO_REFRESH_PREFIXES = ['/api/v1/auth/login', '/api/v1/auth/otp/', '/api/v1/auth/google', REFRESH_PATH, LOGOUT_PATH];

const REFRESH_AHEAD_MS = 2 * 60 * 1000;

function expireSession() {
  sessionExpiredListener?.();
}

let refreshInFlight: Promise<LoginResponse> | null = null;

/**
 * Swaps the refresh token for a new pair. Only one runs at a time: every caller shares the same
 * in-flight promise, because refresh tokens are single-use - a second request carrying the same
 * token would be treated as a replayed (stolen) token and end every session for this login.
 *
 * Rejects with SessionExpiredError when the server says the session is over (and tells App.tsx to
 * log out), or with the underlying network error when offline - which is not a logout.
 */
export function refreshSession(): Promise<LoginResponse> {
  if (refreshInFlight) return refreshInFlight;

  const generation = sessionGeneration;
  const refreshToken = currentSession?.refreshToken;

  refreshInFlight = (async () => {
    if (!refreshToken) {
      expireSession();
      throw new SessionExpiredError();
    }

    const response = await fetchWithTimeout(`${BASE_URL}${REFRESH_PATH}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    syncClockOffset(response);
    const json = await response.json().catch(() => null);

    if (generation !== sessionGeneration) {
      // Logged out or switched while this was in flight - drop the result, and end the session it
      // just created on the server rather than leaving it live until it expires.
      const orphaned: string | undefined = json?.data?.refreshToken;
      if (orphaned) revokeSession({ refreshToken: orphaned });
      throw new SessionExpiredError();
    }

    if (response.status === 401 || response.status === 403) {
      expireSession();
      throw new SessionExpiredError();
    }
    if (!response.ok || !json?.success) {
      throw new ApiError(json?.message ?? `Request failed with status ${response.status}`, response.status);
    }

    const next = json.data as LoginResponse;
    currentSession = next;
    await setStoredSession(next).catch((e) => console.warn('[auth] Failed to store refreshed session', e));
    sessionRefreshedListener?.(next);
    return next;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function accessTokenExpiresSoon(): boolean {
  const expiresAt = currentSession?.accessTokenExpiresAt;
  if (!expiresAt || !currentSession?.refreshToken) return false;
  return new Date(expiresAt).getTime() - serverNow() < REFRESH_AHEAD_MS;
}

/**
 * Refreshes first if the access token is about to expire. For callers that attach the token
 * themselves (file downloads, socket connects) - `api` requests already do this.
 */
export async function ensureFreshAccessToken(): Promise<void> {
  if (accessTokenExpiresSoon()) await refreshSession();
}

/**
 * Ends a session on the server, and with `expoPushToken` also unbinds this phone's push
 * registration so it stops getting the logged-out user's notifications. Fire and forget - logout
 * never waits on the network.
 */
export function revokeSession({ refreshToken, expoPushToken }: { refreshToken?: string | null; expoPushToken?: string | null }) {
  if (!refreshToken && !expoPushToken) return;
  fetch(`${BASE_URL}${LOGOUT_PATH}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refreshToken ?? undefined, expoPushToken: expoPushToken ?? undefined }),
  }).catch(() => {});
}

const UNREGISTER_PUSH_TIMEOUT_MS = 5 * 1000;

/**
 * Removes this phone's push token from the account it was registered to, so a logged-out phone
 * stops getting that user's notifications. Takes the access token explicitly because logout
 * clears the session straight after capturing it. Best effort: it never rejects, gives up after a
 * few seconds, and ignores every failure - including the 404/405 from servers that predate the
 * endpoint, and a 401 from an access token that had already expired.
 */
export async function unregisterPushToken({
  expoPushToken,
  accessToken,
  schoolId,
}: {
  expoPushToken: string;
  accessToken: string | null;
  schoolId?: string | null;
}): Promise<void> {
  if (!accessToken) return;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  if (schoolId) headers['X-School-Id'] = schoolId;
  // The token goes in the query as well as the body - some proxies drop DELETE bodies.
  await fetchWithTimeout(
    `${BASE_URL}/api/v1/notifications/device-token?expoPushToken=${encodeURIComponent(expoPushToken)}`,
    { method: 'DELETE', headers, body: JSON.stringify({ expoPushToken }) },
    UNREGISTER_PUSH_TIMEOUT_MS
  ).catch(() => {});
}

// Countdowns tied to a server-issued deadline (e.g. a Battle Room's joinWindowEndsAt) must not be
// compared against the device's own Date.now() - phone clocks routinely drift by seconds to
// minutes, which shows up as different participants seeing different countdowns for the same
// deadline. Every HTTP response carries a `Date` header stamped by the server, so we use that to
// track how far off the local clock is and correct for it everywhere a countdown reads "now".
let clockOffsetMs = 0;

function syncClockOffset(response: Response) {
  const serverDateHeader = response.headers.get('date');
  if (!serverDateHeader) return;
  const serverTime = new Date(serverDateHeader).getTime();
  if (Number.isNaN(serverTime)) return;
  clockOffsetMs = serverTime - Date.now();
}

export function serverNow(): number {
  return Date.now() + clockOffsetMs;
}

// `body` may be a function, evaluated only once the access token is settled - for requests whose
// body carries the refresh token (profile switch), which a refresh just before sending would rotate.
type RequestBody = unknown | (() => unknown);
// `headers` go on after the defaults, and the 401 refresh-and-retry sends them again unchanged, so
// an Idempotency-Key is the same on the retry and the server can tell it's a repeat.
type RequestOptions = {
  method?: string;
  schoolId?: string;
  body?: RequestBody;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

async function send(path: string, options: RequestOptions) {
  const { method = 'GET', schoolId, body, timeoutMs, headers: extraHeaders } = options;
  const resolvedBody = typeof body === 'function' ? body() : body;
  const tokenUsed = currentSession?.token ?? null;

  // A FormData body (a file upload) goes as multipart; fetch sets the boundary itself, so no Content-Type here.
  const isForm = typeof FormData !== 'undefined' && resolvedBody instanceof FormData;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (schoolId) headers['X-School-Id'] = schoolId;
  if (resolvedBody !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (tokenUsed) headers['Authorization'] = `Bearer ${tokenUsed}`;
  if (extraHeaders) Object.assign(headers, extraHeaders);

  const response = await fetchWithTimeout(
    `${getBaseUrl()}${path}`,
    { method, headers, body: isForm ? (resolvedBody as FormData) : resolvedBody !== undefined ? JSON.stringify(resolvedBody) : undefined },
    timeoutMs
  );
  syncClockOffset(response);
  return { response, tokenUsed };
}

async function rawRequest(path: string, options: RequestOptions = {}): Promise<any> {
  const canRefresh = !NO_REFRESH_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (canRefresh) await ensureFreshAccessToken();

  let { response, tokenUsed } = await send(path, options);

  if (response.status === 401 && canRefresh && currentSession && tokenUsed) {
    if (!currentSession.refreshToken) {
      // A session saved before refresh tokens existed: nothing to renew it with.
      expireSession();
      throw new SessionExpiredError();
    }
    // Several requests can 401 on the same stale token at once. Only the first needs a refresh -
    // if the session has already moved on (or a refresh is running), just use the newer token.
    if (tokenUsed === currentSession.token || refreshInFlight) await refreshSession();
    ({ response } = await send(path, options));
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.message ?? `Request failed with status ${response.status}`,
      response.status,
      json.errorCode ?? undefined,
      json.data ?? undefined
    );
  }

  return json;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const json: ApiResponse<T> = await rawRequest(path, options);
  return json.data as T;
}

// Paginated list endpoints keep `data` as the bare row array (so old, un-updated app builds keep
// working unchanged) and carry `hasNext`/`totalElements` as siblings on the envelope rather than
// nested under `data` - deliberately reverted from a nested `data.content` shape once it was clear
// that would break every already-installed APK the moment it deployed.
async function requestPaginated<T>(path: string, schoolId?: string): Promise<PagedResponse<T>> {
  const json: ApiResponse<T[]> & { hasNext?: boolean; totalElements?: number } = await rawRequest(path, {
    method: 'GET',
    schoolId,
  });
  const content = json.data ?? [];
  return {
    content,
    hasNext: json.hasNext ?? false,
    totalElements: json.totalElements ?? content.length,
  };
}

export const api = {
  get: <T>(path: string, schoolId?: string) => request<T>(path, { method: 'GET', schoolId }),
  getPaginated: <T>(path: string, schoolId?: string) => requestPaginated<T>(path, schoolId),
  post: <T>(path: string, body: RequestBody, schoolId?: string, opts?: { timeoutMs?: number; headers?: Record<string, string> }) =>
    request<T>(path, { method: 'POST', body, schoolId, ...opts }),
  put: <T>(path: string, body: unknown, schoolId: string) =>
    request<T>(path, { method: 'PUT', body, schoolId }),
  patch: <T>(path: string, body: unknown, schoolId: string) =>
    request<T>(path, { method: 'PATCH', body, schoolId }),
  delete: <T>(path: string, schoolId: string) => request<T>(path, { method: 'DELETE', schoolId }),
};
