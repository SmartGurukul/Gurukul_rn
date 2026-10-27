import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, Linking, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { PrincipalNavigator } from './src/navigation/PrincipalNavigator';
import { ParentNavigator } from './src/navigation/ParentNavigator';
import { DriverNavigator } from './src/navigation/DriverNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { colors } from './src/theme/colors';
import { useAppFonts } from './src/theme/typography';
import { SchoolContext } from './src/context/SchoolContext';
import { AuthContext } from './src/context/AuthContext';
import { ToastProvider, useToast } from './src/context/ToastContext';
import { clearStoredSchoolId, getStoredSchoolId, setStoredSchoolId } from './src/api/schoolStorage';
import { getStoredSession, setStoredSession, clearStoredSession, type Session } from './src/api/authStorage';
import {
  getAuthToken,
  getRefreshToken,
  onSessionExpired,
  onSessionRefreshed,
  refreshSession,
  SessionExpiredError,
  setAuthSession,
} from './src/api/client';
import { disconnectChatSocket } from './src/api/chatSocket';
import { loadServerUrlOverride } from './src/api/serverUrl';
import { IncomingCallOverlay } from './src/components/IncomingCallOverlay';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { endSessionOnServer } from './src/push/pushLogout';
import type { AuthProfile, SchoolSearchResult } from './src/api/types';
import { initI18n } from './src/i18n';
import { trackTokenFromUrl } from './src/transport/trackLink';
import { phoneLookupOutcome } from './src/utils/phoneLogin';
import { TrackLinkView } from './src/screens/transport/TrackLinkView';
import PhoneEntryScreen from './src/screens/PhoneEntryScreen';
import ServerSettingsScreen from './src/screens/ServerSettingsScreen';
import PublicSignupScreen from './src/screens/PublicSignupScreen';
import { PUBLIC_SCHOOL_ID } from './src/config/publicSchool';
import SchoolPickScreen from './src/screens/SchoolPickScreen';
import SchoolSetupScreen from './src/screens/SchoolSetupScreen';
import OtpLoginScreen from './src/screens/OtpLoginScreen';
import ProfileSelectScreen from './src/screens/ProfileSelectScreen';
import LoginScreen from './src/screens/LoginScreen';
import RoleSelectScreen, { type RegistrationRole } from './src/screens/RoleSelectScreen';
import RegisterStudentScreen from './src/screens/RegisterStudentScreen';
import RegisterTeacherScreen from './src/screens/RegisterTeacherScreen';
import RegisterParentScreen from './src/screens/RegisterParentScreen';
import RegistrationSubmittedScreen from './src/screens/RegistrationSubmittedScreen';

type PreAuthStep =
  | { name: 'phone' }
  // AI Tutor (student): preview bundles can point the app at another server.
  | { name: 'server' }
  | { name: 'publicSignup'; phone: string }
  | { name: 'pickSchool'; phone: string; schools: SchoolSearchResult[] }
  | { name: 'register' }
  | { name: 'otpLogin'; schoolId: string; schoolName?: string; autoSend?: boolean }
  | { name: 'profileSelect'; schoolId: string; schoolName?: string; selectionToken: string; profiles: AuthProfile[] }
  | { name: 'passwordLogin'; schoolId: string; schoolName?: string }
  | { name: 'roleSelect'; schoolId: string; schoolName?: string }
  | { name: 'registerRole'; schoolId: string; schoolName?: string; role: RegistrationRole }
  | { name: 'registrationSubmitted'; schoolId: string; schoolName?: string; message: string };

function hasPassed(isoTime?: string) {
  return !!isoTime && new Date(isoTime).getTime() <= Date.now();
}

/** Lives inside ToastProvider (which App itself renders) so it can show the session-expired toast. */
function SessionExpiredToast({ notice }: { notice: number }) {
  const { showToast } = useToast();
  const { t } = useTranslation();
  useEffect(() => {
    if (notice > 0) showToast(t('auth.sessionExpired'), 'info');
  }, [notice, showToast, t]);
  return null;
}

export default function App() {
  const [schoolId, setSchoolId] = useState<string | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [preAuthStep, setPreAuthStep] = useState<PreAuthStep>({ name: 'phone' });
  // The number the first screen looked up and the schools that know it. Locks the number on the
  // OTP screen and decides where "back" goes from there (the pick when there were several).
  const [phoneLogin, setPhoneLogin] = useState<{ phone: string; schools: SchoolSearchResult[] } | null>(null);
  const [i18nReady, setI18nReady] = useState(false);
  const fontsReady = useAppFonts();
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(0);
  // A WhatsApp "track the bus" link opened in the app (App Links) - shown over whatever is open,
  // signed in or not, since the link itself grants access.
  const [trackToken, setTrackToken] = useState<string | null>(null);

  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => setTrackToken((current) => trackTokenFromUrl(url) ?? current))
      .catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const token = trackTokenFromUrl(url);
      if (token) setTrackToken(token);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  // The stored school keeps a signed-in session attached to its school across restarts. It no
  // longer chooses the login screen: that starts from the phone number, which finds the school.
  useEffect(() => {
    getStoredSchoolId().then(setSchoolId);
  }, []);

  // The client module owns the live session once it's set (it rotates the tokens on every silent
  // refresh), so App only hands it a new session at login/switch/logout and follows its refreshes -
  // never the other way round, which could put back an already-used refresh token.
  const sessionExpiredRef = useRef<() => void>(() => {});
  useEffect(() => {
    onSessionRefreshed(setSession);
    onSessionExpired(() => sessionExpiredRef.current());
    return () => {
      onSessionRefreshed(null);
      onSessionExpired(null);
    };
  }, []);

  useEffect(() => {
    (async () => {
      // A preview bundle's saved server override must apply before the first request (the session
      // refresh below). It never throws, and the app starts on the default server when it fails.
      await loadServerUrlOverride().catch(() => null);
      const stored = await getStoredSession().catch(() => null);
      if (!stored) {
        setSession(null);
        return;
      }
      if (stored.refreshToken && hasPassed(stored.refreshTokenExpiresAt)) {
        await clearStoredSession();
        setSession(null);
        setSessionExpiredNotice((n) => n + 1);
        return;
      }
      setAuthSession(stored);
      // Access token already expired: renew it behind the splash so home doesn't open onto a wall
      // of failing requests. Offline is fine - keep the stored session, the next request retries.
      if (stored.refreshToken && hasPassed(stored.accessTokenExpiresAt)) {
        try {
          setSession(await refreshSession());
          return;
        } catch (e) {
          if (e instanceof SessionExpiredError) return; // handleSessionExpired has already run
        }
      }
      setSession(stored);
    })();
  }, []);

  usePushNotifications(schoolId ?? null, session ?? null);

  const handleLoggedIn = (next: Session) => {
    setAuthSession(next);
    setStoredSession(next);
    setSession(next);
  };

  const endSession = () => {
    disconnectChatSocket();
    setAuthSession(null);
    clearStoredSession();
    setSession(null);
    setPhoneLogin(null);
    setPreAuthStep({ name: 'phone' });
  };

  const handleLogout = () => {
    // Captured before the session is cleared: the push token lookup may read storage, so the
    // unbind and revoke go out a moment later, carrying these rather than the (gone) session.
    // Logout itself never waits on them.
    endSessionOnServer({ accessToken: getAuthToken(), refreshToken: getRefreshToken(), schoolId });
    endSession();
  };

  // Several requests can fail on the same dead session at once - only the first one logs out.
  const handleSessionExpired = () => {
    if (!getAuthToken()) return;
    endSession();
    setSessionExpiredNotice((n) => n + 1);
  };
  useEffect(() => {
    sessionExpiredRef.current = handleSessionExpired;
  });

  // Switching to a sibling/self profile keeps the same phone-number login but swaps identity - the
  // old socket connection was authenticated as the previous owner, so it must be torn down before
  // usePushNotifications (keyed on the session's owner) re-registers the device under the new one.
  const handleSwitchProfile = (next: Session) => {
    disconnectChatSocket();
    setAuthSession(next);
    setStoredSession(next);
    setSession(next);
  };

  // The number is known to be on file at this school, so the code goes out as the screen opens.
  const openOtpLogin = (school: SchoolSearchResult) => {
    setSchoolId(school.id);
    // Persist it like SchoolSetupScreen does - otherwise an app restart has a stored session but no
    // school, and drops the user back on the pre-login screens.
    setStoredSchoolId(school.id);
    setPreAuthStep({ name: 'otpLogin', schoolId: school.id, schoolName: school.name, autoSend: true });
  };

  // A number on file at no school becomes a schoolless (public) student under the virtual Open
  // School. Persist that school id up front, exactly like openOtpLogin, so a restart mid-signup
  // still has a school to land on.
  const openPublicSignup = (phone: string) => {
    setSchoolId(PUBLIC_SCHOOL_ID);
    setStoredSchoolId(PUBLIC_SCHOOL_ID);
    setPreAuthStep({ name: 'publicSignup', phone });
  };

  // One school goes straight to its OTP, code already on its way; several ask which. A number
  // registered nowhere never gets here - the screen handles it.
  const handlePhoneSchools = (phone: string, schools: SchoolSearchResult[]) => {
    setPhoneLogin({ phone, schools });
    const outcome = phoneLookupOutcome(schools);
    if (outcome.kind === 'single') openOtpLogin(outcome.school);
    else if (outcome.kind === 'choose') setPreAuthStep({ name: 'pickSchool', phone, schools });
  };

  // The sign-up hands back the principal's ADMIN session (the phone they typed), so they land on
  // the home screen signed in and the OTP login afterwards goes to the same number.
  const handleRegistered = (newSchoolId: string, principal: Session) => {
    setSchoolId(newSchoolId);
    handleLoggedIn(principal);
  };

  const loading = schoolId === undefined || session === undefined || !i18nReady || !fontsReady;

  const renderPreAuth = () => {
    switch (preAuthStep.name) {
      case 'phone':
        return (
          <PhoneEntryScreen
            onSchoolsFound={handlePhoneSchools}
            onRegisterSchool={() => setPreAuthStep({ name: 'register' })}
            onContinueAsPublic={openPublicSignup}
            onOpenServer={() => setPreAuthStep({ name: 'server' })}
          />
        );
      case 'server':
        return <ServerSettingsScreen onBack={() => setPreAuthStep({ name: 'phone' })} />;
      case 'publicSignup':
        return (
          <PublicSignupScreen
            initialPhone={preAuthStep.phone}
            onLoggedIn={handleLoggedIn}
            onBack={() => {
              // Back out of the virtual school too, or the stored Open-School id strands a restart
              // on a screenless public shell.
              setSchoolId(null);
              clearStoredSchoolId();
              setPreAuthStep({ name: 'phone' });
            }}
          />
        );
      case 'pickSchool':
        return (
          <SchoolPickScreen
            phone={preAuthStep.phone}
            schools={preAuthStep.schools}
            onBack={() => setPreAuthStep({ name: 'phone' })}
            onSelect={openOtpLogin}
          />
        );
      case 'register':
        return (
          <SchoolSetupScreen
            onBack={() => setPreAuthStep({ name: 'phone' })}
            onRegistered={handleRegistered}
          />
        );
      case 'otpLogin':
        return (
          <OtpLoginScreen
            schoolId={preAuthStep.schoolId}
            schoolName={preAuthStep.schoolName}
            initialPhone={phoneLogin?.phone}
            onChangePhone={() => setPreAuthStep({ name: 'phone' })}
            autoSend={preAuthStep.autoSend}
            onBack={() =>
              setPreAuthStep(
                phoneLogin && phoneLogin.schools.length > 1
                  ? { name: 'pickSchool', phone: phoneLogin.phone, schools: phoneLogin.schools }
                  : { name: 'phone' }
              )
            }
            onUsePassword={() =>
              setPreAuthStep({
                name: 'passwordLogin',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
            onLoggedIn={handleLoggedIn}
            onProfileSelectionRequired={(selectionToken, profiles) =>
              setPreAuthStep({
                name: 'profileSelect',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
                selectionToken,
                profiles,
              })
            }
            onRegister={() =>
              setPreAuthStep({
                name: 'roleSelect',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
          />
        );
      case 'profileSelect':
        return (
          <ProfileSelectScreen
            schoolId={preAuthStep.schoolId}
            schoolName={preAuthStep.schoolName}
            selectionToken={preAuthStep.selectionToken}
            profiles={preAuthStep.profiles}
            onSelected={handleLoggedIn}
            onBack={() =>
              setPreAuthStep({
                name: 'otpLogin',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
          />
        );
      case 'passwordLogin':
        return (
          <LoginScreen
            schoolId={preAuthStep.schoolId}
            onBack={() =>
              setPreAuthStep({
                name: 'otpLogin',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
            onLoggedIn={handleLoggedIn}
            onRegister={() =>
              setPreAuthStep({
                name: 'roleSelect',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
          />
        );
      case 'roleSelect':
        return (
          <RoleSelectScreen
            schoolName={preAuthStep.schoolName}
            onBack={() =>
              setPreAuthStep({
                name: 'otpLogin',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
            onSelectRole={(role) =>
              setPreAuthStep({
                name: 'registerRole',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
                role,
              })
            }
          />
        );
      case 'registerRole': {
        const { schoolId: regSchoolId, schoolName, role } = preAuthStep;
        const onBack = () => setPreAuthStep({ name: 'roleSelect', schoolId: regSchoolId, schoolName });
        const onSubmitted = (message: string) =>
          setPreAuthStep({ name: 'registrationSubmitted', schoolId: regSchoolId, schoolName, message });
        if (role === 'student') {
          return <RegisterStudentScreen schoolId={regSchoolId} onBack={onBack} onSubmitted={onSubmitted} />;
        }
        if (role === 'teacher') {
          return <RegisterTeacherScreen schoolId={regSchoolId} onBack={onBack} onSubmitted={onSubmitted} />;
        }
        return <RegisterParentScreen schoolId={regSchoolId} onBack={onBack} onSubmitted={onSubmitted} />;
      }
      case 'registrationSubmitted':
        return (
          <RegistrationSubmittedScreen
            message={preAuthStep.message}
            onDone={() =>
              setPreAuthStep({
                name: 'otpLogin',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
          />
        );
    }
  };

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <SessionExpiredToast notice={sessionExpiredNotice} />
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !schoolId || !session ? (
          renderPreAuth()
        ) : (
          <SchoolContext.Provider value={schoolId}>
            <AuthContext.Provider value={{ session, logout: handleLogout, switchProfile: handleSwitchProfile }}>
              <NavigationContainer ref={navigationRef}>
                {session.role === 'DRIVER' ? (
                  <DriverNavigator />
                ) : session.ownerType === 'PARENT' ? (
                  <ParentNavigator />
                ) : (
                  <PrincipalNavigator />
                )}
              </NavigationContainer>
              <IncomingCallOverlay session={session} schoolId={schoolId} />
            </AuthContext.Provider>
          </SchoolContext.Provider>
        )}
        {trackToken && i18nReady && <TrackLinkView token={trackToken} onClose={() => setTrackToken(null)} />}
      </ToastProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
