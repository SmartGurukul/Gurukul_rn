import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/client';
import { getEmployeeAttendanceHistory, selfMarkAttendance } from '../../api/staffAttendance';
import type { AttendanceStatus, EmployeeAttendanceHistory, StaffAttendanceRecord } from '../../api/types';
import { toIsoDate } from '../../components/DatePickerField';
import { MonthAttendanceCalendar } from '../../components/MonthAttendanceCalendar';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { defaultIntegrityDeps, isIntegrityRefusal, withPlayIntegrity } from '../../utils/selfMarkIntegrity';
import { readSelfMarkLocation, SelfMarkLocationError, skipsDeviceChecks } from '../../utils/selfMarkLocation';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'MarkMyAttendance'>;

// 'setByAdmin': an admin already entered today's attendance (e.g. ABSENT), and only an admin can
// change it - so there's nothing to retry. 'verifying': getting a Play Integrity token (Android).
type Status = 'checking' | 'idle' | 'locating' | 'verifying' | 'submitting' | 'success' | 'error' | 'setByAdmin';

// The backend's 409 code when a self check-in would overwrite an admin's entry for today.
const ATTENDANCE_SET_BY_ADMIN = 'ATTENDANCE_SET_BY_ADMIN';

/** An admin's entry other than present - showing it as "You're marked present" would be wrong. */
function isAdminEnteredNonPresent(record: StaffAttendanceRecord) {
  return !record.selfMarked && record.method == null && record.status !== 'PRESENT';
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthRange(month: Date) {
  const from = toIsoDate(new Date(month.getFullYear(), month.getMonth(), 1));
  const to = toIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  return { from, to };
}

export function MarkMyAttendanceScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<StaffAttendanceRecord | null>(null);
  const [month, setMonth] = useState(() => new Date());
  const [monthHistory, setMonthHistory] = useState<EmployeeAttendanceHistory | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(true);

  useEffect(() => {
    setLoadingMonth(true);
    const { from, to } = monthRange(month);
    getEmployeeAttendanceHistory(schoolId, session.ownerId, from, to)
      .then(setMonthHistory)
      .catch(() => setMonthHistory(null))
      .finally(() => setLoadingMonth(false));
  }, [schoolId, session.ownerId, month]);

  const recordsByDate = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {};
    monthHistory?.records.forEach((r) => {
      map[r.attendanceDate] = r.status;
    });
    return map;
  }, [monthHistory]);

  useEffect(() => {
    const today = todayDate();
    getEmployeeAttendanceHistory(schoolId, session.ownerId, today, today)
      .then((history) => {
        const todayRecord = history.records.find((r) => r.attendanceDate === today);
        if (todayRecord && isAdminEnteredNonPresent(todayRecord)) {
          setRecord(todayRecord);
          setError(
            t('staffAttendance.selfMark.setByAdmin', {
              status: t(`staffAttendance.statuses.${todayRecord.status}`),
            })
          );
          setStatus('setByAdmin');
        } else if (todayRecord) {
          setRecord(todayRecord);
          setStatus('success');
        } else {
          setStatus('idle');
        }
      })
      .catch(() => setStatus('idle'));
  }, [schoolId, session.ownerId, t]);

  const handleMark = async () => {
    setError(null);
    setStatus('locating');
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setError('Location permission is required to mark attendance from here.');
        setStatus('error');
        return;
      }

      const location = await readSelfMarkLocation();
      // 'verifying' only once Google Play is really asked (not on iOS, in OFF mode or on an older backend).
      const request = await withPlayIntegrity(location, {
        ...defaultIntegrityDeps(schoolId),
        onRequestingToken: () => setStatus('verifying'),
      });
      setStatus('submitting');
      const saved = await selfMarkAttendance(schoolId, request);
      setRecord(saved);
      setStatus('success');
    } catch (e) {
      // The server's Play Integrity refusals say what to do; getErrorMessage would turn the 503 one into
      // generic "unavailable" text.
      setError(e instanceof SelfMarkLocationError || isIntegrityRefusal(e) ? e.message : getErrorMessage(e));
      if (e instanceof ApiError && e.errorCode === ATTENDANCE_SET_BY_ADMIN) {
        setStatus('setByAdmin');
        // Reload the calendar so it shows the admin's entry for today.
        setMonth((m) => new Date(m));
      } else {
        setStatus('error');
      }
    }
  };

  const busy = status === 'locating' || status === 'verifying' || status === 'submitting';

  return (
    <View style={styles.root}>
      <ScreenHeader title="Mark My Attendance" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {session.role === 'ADMIN' && (
          <Pressable
            style={styles.locationLink}
            onPress={() => navigation.navigate('SchoolLocationSettings')}
          >
            <Text style={styles.locationLinkText}>📍 Update school location &amp; radius</Text>
          </Pressable>
        )}
        <View style={styles.card}>
          {status === 'checking' ? (
            <ActivityIndicator color={colors.primary} />
          ) : status === 'success' && record ? (
            <>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.title}>You&apos;re marked present</Text>
              <Text style={styles.subtitle}>{record.attendanceDate}</Text>
              <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
                <Text style={styles.secondaryButtonText}>Done</Text>
              </Pressable>
            </>
          ) : status === 'setByAdmin' ? (
            <>
              <Text style={styles.title}>{t('staffAttendance.selfMark.setByAdminTitle')}</Text>
              {error && <ErrorNotice message={error} />}
              <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
                <Text style={styles.secondaryButtonText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Check in from the school</Text>
              <Text style={styles.subtitle}>
                We&apos;ll use your current location to confirm you&apos;re within the school&apos;s premises before
                marking today&apos;s attendance.
              </Text>
              {error && <ErrorNotice message={error} />}
              <Pressable
                style={styles.primaryButton}
                onPress={handleMark}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {status === 'error' ? 'Try again' : 'Mark my attendance'}
                  </Text>
                )}
              </Pressable>
              {status === 'locating' && <Text style={styles.hint}>Getting your location...</Text>}
              {status === 'verifying' && <Text style={styles.hint}>Checking this phone with Google Play...</Text>}
              {status === 'submitting' && <Text style={styles.hint}>Verifying you&apos;re within range...</Text>}
              {skipsDeviceChecks() && (
                <Text style={styles.hint}>
                  Expo Go: this phone&apos;s fake-GPS checks are skipped. Only a school that allows unverified phones
                  (the demo school) accepts the check-in.
                </Text>
              )}
            </>
          )}
        </View>

        <Text style={styles.calendarTitle}>Past attendance</Text>
        <View style={styles.calendarCard}>
          {loadingMonth && <ActivityIndicator style={styles.loading} color={colors.primary} />}
          <MonthAttendanceCalendar month={month} onMonthChange={setMonth} recordsByDate={recordsByDate} />
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  locationLink: {
    alignSelf: 'flex-end',
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  locationLinkText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  successIcon: {
    fontSize: 40,
    color: colors.success,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  error: { color: colors.error, fontSize: 13, textAlign: 'center', marginBottom: spacing.md },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    minWidth: 200,
  },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    minWidth: 200,
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md },
  calendarTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  calendarCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  loading: { marginBottom: spacing.sm },
});
