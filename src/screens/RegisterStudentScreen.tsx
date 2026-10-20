import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { registerStudent, registerStudentWithInvite } from '../api/registration';
import { LanguageSwitch } from '../components/LanguageSwitch';
import LabeledInput from '../components/LabeledInput';
import { VioletHero } from '../components/VioletHero';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import { getErrorMessage } from '../api/errorMessage';
import { ErrorNotice } from '../components/ErrorNotice';

interface Props {
  schoolId: string;
  onBack: () => void;
  onSubmitted: (message: string) => void;
}

export default function RegisterStudentScreen({ schoolId, onBack, onSubmitted }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [useInviteCode, setUseInviteCode] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password === confirmPassword;
  const referenceValue = useInviteCode ? inviteCode : registrationNumber;
  const canSubmit = !!referenceValue && !!username && password.length >= 8 && passwordsMatch;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = useInviteCode
        ? await registerStudentWithInvite(schoolId, { inviteCode, username, password })
        : await registerStudent(schoolId, { registrationNumber, username, password });
      onSubmitted(result.message);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <VioletHero style={styles.hero}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={[styles.languageSwitchWrapper, { top: insets.top + spacing.xs }]}>
          <LanguageSwitch />
        </View>
        <Text style={styles.title}>{t('registration.student.title')}</Text>
        <Text style={styles.subtitle}>{t('registration.student.subtitle')}</Text>
      </VioletHero>

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleButton, !useInviteCode && styles.toggleButtonActive]}
            onPress={() => setUseInviteCode(false)}
          >
            <Text style={[styles.toggleText, !useInviteCode && styles.toggleTextActive]}>
              {t('registration.student.registrationNumber')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, useInviteCode && styles.toggleButtonActive]}
            onPress={() => setUseInviteCode(true)}
          >
            <Text style={[styles.toggleText, useInviteCode && styles.toggleTextActive]}>Invite code</Text>
          </Pressable>
        </View>

        {useInviteCode ? (
          <LabeledInput
            label="Invite code"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            placeholder="e.g. K7M2QXPZ"
          />
        ) : (
          <LabeledInput
            label={t('registration.student.registrationNumber')}
            value={registrationNumber}
            onChangeText={setRegistrationNumber}
            autoCapitalize="characters"
            placeholder={t('registration.student.registrationNumberPlaceholder')}
          />
        )}

        <Text style={styles.sectionLabel}>{t('registration.yourLogin')}</Text>
        <LabeledInput label={t('registration.username')} value={username} onChangeText={setUsername} autoCapitalize="none" />
        <LabeledInput label={t('registration.passwordMin8')} value={password} onChangeText={setPassword} secureTextEntry />
        <LabeledInput
          label={t('registration.confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        {!!confirmPassword && !passwordsMatch && <Text style={styles.mismatch}>{t('registration.passwordsDontMatch')}</Text>}

        {error && <ErrorNotice message={error} />}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.disabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? t('registration.submitting') : t('registration.submitRegistration')}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingTop: spacing.xxl * 1.5,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  backButton: {
    position: 'absolute',
    top: spacing.xxl,
    left: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  languageSwitchWrapper: {
    position: 'absolute',
    right: spacing.lg,
  },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4, paddingHorizontal: spacing.lg, textAlign: 'center' },
  form: { flex: 1 },
  formContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  toggleButtonActive: { backgroundColor: colors.primary },
  toggleText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  toggleTextActive: { color: colors.white },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  mismatch: { color: colors.error, fontSize: 12.5, marginTop: -spacing.sm, marginBottom: spacing.md },
  error: { color: colors.error, marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
