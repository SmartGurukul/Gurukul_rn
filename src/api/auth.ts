import { api, getRefreshToken } from './client';
import { PUBLIC_SCHOOL_ID } from '../config/publicSchool';
import type {
  AuthProfile,
  ChangeClassRequest,
  GoogleLoginRequest,
  LoginRequest,
  LoginResponse,
  OtpRequest,
  OtpVerifyRequest,
  OtpVerifyResponse,
  PublicSignupRequest,
  SchoolSearchResult,
  SelectProfileRequest,
  SwitchProfileRequest,
} from './types';

export function login(schoolId: string, req: LoginRequest) {
  return api.post<LoginResponse>('/api/v1/auth/login', req, schoolId);
}

export function loginWithGoogle(schoolId: string, req: GoogleLoginRequest) {
  return api.post<LoginResponse>('/api/v1/auth/google', req, schoolId);
}

/**
 * The schools a phone number can log in to - the app's first question, asked before any school is
 * chosen, so this is the one auth call without an X-School-Id. Empty when the number is on file
 * nowhere.
 */
export function lookupSchoolsByPhone(phone: string) {
  return api.post<SchoolSearchResult[]>('/api/v1/auth/phone/schools', { phone });
}

export function requestOtp(schoolId: string, req: OtpRequest) {
  return api.post<void>('/api/v1/auth/otp/request', req, schoolId);
}

export function verifyOtp(schoolId: string, req: OtpVerifyRequest) {
  return api.post<OtpVerifyResponse>('/api/v1/auth/otp/verify', req, schoolId);
}

export function selectProfile(schoolId: string, req: SelectProfileRequest) {
  return api.post<LoginResponse>('/api/v1/auth/otp/select-profile', req, schoolId);
}

// Public (schoolless) students: the virtual Open School. Unlike requestOtp, an unknown phone is
// allowed to self-sign-up here; publicSignup returns a full student session.
export function requestPublicOtp(req: OtpRequest) {
  return api.post<void>('/api/v1/auth/public/otp/request', req, PUBLIC_SCHOOL_ID);
}

export function publicSignup(req: PublicSignupRequest) {
  return api.post<LoginResponse>('/api/v1/auth/public/signup', req, PUBLIC_SCHOOL_ID);
}

export function changeMyClass(req: ChangeClassRequest) {
  return api.put<void>('/api/v1/auth/public/class', req, PUBLIC_SCHOOL_ID);
}

export function listProfiles(schoolId: string) {
  return api.get<AuthProfile[]>('/api/v1/auth/profiles', schoolId);
}

/**
 * Sends the current refresh token so the backend ends the old profile's session. It's read lazily,
 * at send time, because the request may first refresh an about-to-expire access token - which
 * rotates the refresh token, and sending the old one would look like a replayed (stolen) token.
 */
export function switchProfile(schoolId: string, req: Omit<SwitchProfileRequest, 'refreshToken'>) {
  return api.post<LoginResponse>(
    '/api/v1/auth/profiles/switch',
    () => ({ ...req, refreshToken: getRefreshToken() ?? undefined }),
    schoolId
  );
}
