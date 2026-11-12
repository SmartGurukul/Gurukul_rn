import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { startImmediateCall } from '../../api/calls';
import { createConversation } from '../../api/chat';
import { createEmployeeCredential, setEmployeeRole } from '../../api/credentials';
import type { StaffRole } from '../../api/types';
import { AttendanceIdentifiersPanel } from '../../components/AttendanceIdentifiersPanel';
import { AvatarBadge } from '../../components/AvatarBadge';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { FEATURE_FLAGS } from '../../config/featureFlags';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useGoogleMeetGate } from '../../hooks/useGoogleMeetGate';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { visibleEmployeeFields, type EmployeeDetailField } from '../../utils/employeeFields';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'EmployeeDetail'>;

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

export function EmployeeDetailScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const isViewerAdmin = session.role === 'ADMIN';
  const { t } = useTranslation();
  const employee = route.params.employee;
  const [showCredentials, setShowCredentials] = useState(false);
  const [showAttendanceIdentifiers, setShowAttendanceIdentifiers] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [role, setRole] = useState(employee.role);
  const [changingRole, setChangingRole] = useState(false);
  const [roleNotice, setRoleNotice] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const isSelf = session.ownerType === 'EMPLOYEE' && session.ownerId === employee.id;
  const confirmBeforeCall = useGoogleMeetGate(schoolId, navigation);
  // Non-admins get hidden fields as null from the backend; those rows are left out, not shown as "—".
  const detailFields = visibleEmployeeFields(employee, isViewerAdmin);
  const fieldLabels: Record<EmployeeDetailField, string> = {
    designation: t('employees.detail.designation'),
    joinDate: t('employees.detail.joinDate'),
    bankAccount: t('employees.detail.bankAccount'),
    contactPhone: t('employees.detail.contactPhone'),
  };

  const handleVideoCall = () => {
    setCalling(true);
    setError(null);
    confirmBeforeCall(
      async () => {
        try {
          const call = await startImmediateCall(schoolId, { calleeOwnerType: 'EMPLOYEE', calleeOwnerId: employee.id });
          navigation.navigate('InCall', {
            roomName: call.roomName,
            provider: call.provider,
            displayName: employee.name,
            callLogId: call.callLogId,
          });
        } catch (e) {
          setError(getErrorMessage(e));
        } finally {
          setCalling(false);
        }
      },
      () => setCalling(false)
    );
  };

  const handleMessage = async () => {
    setMessaging(true);
    setError(null);
    try {
      const conversation = await createConversation(schoolId, {
        otherPartyOwnerType: 'EMPLOYEE',
        otherPartyOwnerId: employee.id,
      });
      navigation.navigate('ConversationThread', { conversationId: conversation.id, title: employee.name });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setMessaging(false);
    }
  };

  // Admin ⇄ teacher. Confirmed first (a native alert; the browser's own confirm on web), never on
  // yourself (the server refuses that too), and a staff member with no login gets one on their phone.
  const applyRole = async (next: StaffRole) => {
    setChangingRole(true);
    setError(null);
    setRoleNotice(null);
    try {
      const updated = await setEmployeeRole(schoolId, employee.id, next);
      setRole(updated.role);
      setRoleNotice(t('employees.detail.roleUpdated', { name: employee.name }));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setChangingRole(false);
    }
  };
  const handleChangeRole = () => {
    const next: StaffRole = role === 'ADMIN' ? 'TEACHER' : 'ADMIN';
    const title = next === 'ADMIN' ? t('employees.detail.makeAdmin') : t('employees.detail.makeTeacher');
    const body = next === 'ADMIN'
      ? t('employees.detail.makeAdminConfirm', { name: employee.name })
      : t('employees.detail.makeTeacherConfirm', { name: employee.name });
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${body}`)) void applyRole(next);
      return;
    }
    Alert.alert(title, body, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: title, style: next === 'ADMIN' ? 'default' : 'destructive', onPress: () => void applyRole(next) },
    ]);
  };

  const handleCreateCredential = async () => {
    setSubmitting(true);
    setError(null);
    setCreated(null);
    try {
      await createEmployeeCredential(schoolId, employee.id, { username, password, role: 'TEACHER' });
      setCreated({ username, password });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={employee.name} subtitle={employee.designation} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.heroRow}>
          <AvatarBadge name={employee.name} accentKey="employees" size={56} />
          <View style={styles.heroText}>
            <Text style={styles.heroName}>{employee.name}</Text>
            <View style={styles.chipRow}>
              <StatusChip
                label={employee.status === 'ACTIVE' ? t('common.active') : employee.status === 'INACTIVE' ? t('common.inactive') : employee.status}
                variant={employee.status === 'ACTIVE' ? 'success' : 'neutral'}
              />
              {isViewerAdmin && role !== 'DRIVER' && (
                <StatusChip
                  label={role === 'ADMIN' ? t('employees.detail.roleAdmin') : role === 'TEACHER' ? t('employees.detail.roleTeacher') : t('employees.detail.roleNone')}
                  variant={role === 'ADMIN' ? 'info' : 'neutral'}
                />
              )}
            </View>
          </View>
          {!isSelf && (
            <View style={styles.heroActions}>
              {FEATURE_FLAGS.videoCalls && (
                <Pressable style={styles.iconButton} onPress={handleVideoCall} disabled={calling}>
                  {calling ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <FontAwesome5 name="video" size={16} color={colors.white} />
                  )}
                </Pressable>
              )}
              <Pressable style={styles.iconButton} onPress={handleMessage} disabled={messaging}>
                {messaging ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <FontAwesome5 name="comment-dots" size={16} color={colors.white} />
                )}
              </Pressable>
            </View>
          )}
        </View>

        {detailFields.length > 0 && (
          <View style={styles.card}>
            {detailFields.map((field) => (
              <Field key={field} label={fieldLabels[field]} value={employee[field]} />
            ))}
          </View>
        )}

        {error && <ErrorNotice message={error} />}
        {roleNotice && <Text style={styles.success}>{roleNotice}</Text>}

        {isViewerAdmin && (
          <View style={styles.actions}>
            {!isSelf && role !== 'DRIVER' && (
              <Pressable
                style={[styles.actionButton, styles.roleButton, changingRole && styles.disabled]}
                onPress={handleChangeRole}
                disabled={changingRole}
                accessibilityRole="button"
              >
                <Text style={styles.actionText}>
                  {changingRole ? '…' : role === 'ADMIN' ? t('employees.detail.makeTeacher') : t('employees.detail.makeAdmin')}
                </Text>
              </Pressable>
            )}
            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('EmployeeForm', { employee })}>
              <Text style={styles.actionText}>{t('common.edit')}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('SalaryHistory', { employee })}>
              <Text style={styles.actionText}>{t('employees.detail.salaryHistory')}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('TeacherPerformance', { employee })}>
              <Text style={styles.actionText}>{t('performance.title')}</Text>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={() => navigation.navigate('EmployeeAttendanceHistory', { employee: { id: employee.id, name: employee.name } })}
            >
              <Text style={styles.actionText}>Attendance</Text>
            </Pressable>
            {employee.employeeType !== 'NON_TEACHING' && (
              <Pressable
                style={styles.actionButton}
                onPress={() => navigation.navigate('MyTimetable', { teacher: { id: employee.id, name: employee.name } })}
              >
                <Text style={styles.actionText}>{t('employees.detail.timetable')}</Text>
              </Pressable>
            )}
            <Pressable style={styles.actionButton} onPress={() => setShowCredentials((v) => !v)}>
              <Text style={styles.actionText}>{showCredentials ? t('common.cancel') : 'Set login credentials'}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => setShowAttendanceIdentifiers((v) => !v)}>
              <Text style={styles.actionText}>
                {showAttendanceIdentifiers ? t('common.cancel') : t('attendanceIdentifiers.actionButton')}
              </Text>
            </Pressable>
          </View>
        )}

        {isViewerAdmin && showAttendanceIdentifiers && (
          <View style={styles.credentialPanel}>
            <AttendanceIdentifiersPanel ownerType="EMPLOYEE" ownerId={employee.id} />
          </View>
        )}

        {isViewerAdmin && showCredentials && (
          <View style={styles.credentialPanel}>
            <Text style={styles.credentialTitle}>Create teacher login</Text>
            {created ? (
              <View>
                <Text style={styles.success}>
                  Credential created. Share these with {employee.name} — they won&apos;t be shown again:
                </Text>
                <View style={styles.credentialBox}>
                  <Text style={styles.credentialLabel}>Username</Text>
                  <Text style={styles.credentialValue}>{created.username}</Text>
                  <Text style={[styles.credentialLabel, { marginTop: spacing.sm }]}>Password</Text>
                  <Text style={styles.credentialValue}>{created.password}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setCreated(null);
                    setUsername('');
                    setPassword('');
                  }}
                >
                  <Text style={styles.doneLink}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <LabeledInput label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
                <LabeledInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />
                {error && <ErrorNotice message={error} />}
                <Pressable
                  style={[styles.credentialSubmit, (!username || !password || submitting) && styles.disabled]}
                  onPress={handleCreateCredential}
                  disabled={!username || !password || submitting}
                >
                  <Text style={styles.credentialSubmitText}>{submitting ? 'Creating…' : 'Create credential'}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const accent = accents.employees;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  heroText: { flex: 1, marginLeft: spacing.md, gap: spacing.xs },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  fieldValue: { fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chipRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: 4 },
  roleButton: { borderWidth: 1, borderColor: accent.base },
  actionButton: {
    backgroundColor: accent.light,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionText: { color: accent.base, fontWeight: '700' },
  credentialPanel: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  credentialTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  error: { color: colors.error, marginBottom: spacing.md },
  success: { color: colors.success, marginBottom: spacing.md, lineHeight: 20 },
  credentialBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  credentialLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  credentialValue: { fontSize: 16, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
  doneLink: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
  credentialSubmit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  credentialSubmitText: { color: colors.white, fontWeight: '700' },
});
