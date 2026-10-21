import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardInset } from '../hooks/useKeyboardInset';

import { requestOtp, verifyOtp } from '../api/auth';
import { setAuthSession } from '../api/client';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { Logo } from '../components/Logo';
import { VioletHero } from '../components/VioletHero';
import LabeledInput from '../components/LabeledInput';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import type { Session } from '../api/authStorage';
import type { AuthProfile } from '../api/types';
import { getErrorMessage } from '../api/errorMessage';

interface Props {
  schoolId: string;
  schoolName?: string;
  onBack: () => void;
  onUsePassword: () => void;
  onLoggedIn: (session: Session) => void;
  onProfileSelectionRequired: (selectionToken: string, profiles: AuthProfile[]) => void;
  onRegister?: () => void;
  /** The number the first screen looked up: shown locked here; "change" goes to onChangePhone. */
  initialPhone?: string;
  /** Where "Change phone number" goes for a locked number - the first screen, not merely one step back. */
  onChangePhone?: () => void;
  /** Send the code as soon as the screen opens - the number is already known to be on file here. */
  autoSend?: boolean;
}

export default function OtpLoginScreen({
  schoolId,
  schoolName,
  onBack,
  onUsePassword,
  onLoggedIn,
  onProfileSelectionRequired,
  onRegister,
  initialPhone,
  onChangePhone,
  autoSend,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await requestOtp(schoolId, { phone });
      setOtpSent(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // Once per mount, not per re-render: a second send inside the cooldown would be refused.
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (!autoSend || !initialPhone || autoSentRef.current) return;
    autoSentRef.current = true;
    handleRequestOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerifyOtp = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await verifyOtp(schoolId, { phone, otp });
      if (response.profileSelectionRequired && response.selectionToken && response.profiles) {
        onProfileSelectionRequired(response.selectionToken, response.profiles);
        return;
      }
      setAuthSession(response);
      onLoggedIn(response);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <VioletHero style={styles.hero}>
        <Pressable onPress={onBack} style={[styles.backButton, { top: insets.top + spacing.xs }]} accessibilityRole="button">
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={[styles.languageSwitchWrapper, { top: insets.top + spacing.xs }]}>
          <LanguageSwitch />
        </View>
        <Logo width={120} />
        <Text style={styles.title}>{schoolName ?? t('auth.signIn')}</Text>
        <Text style={styles.subtitle}>{t('auth.signInWithPhoneSubtitle')}</Text>
      </VioletHero>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={[styles.form, { paddingBottom: spacing.xl + keyboardInset }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LabeledInput
          label={t('auth.phoneNumber')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!otpSent && !initialPhone}
        />

        {otpSent && (
          <>
            <Text style={styles.otpHint}>{t('auth.otpSentViaWhatsapp')}</Text>
            <LabeledInput label={t('auth.otp')} value={otp} onChangeText={setOtp} keyboardType="number-pad" placeholder="••••" />
          </>
        )}

        {error && (
          <Text style={[styles.error, error.includes('pending admin approval') && styles.pendingNotice]}>
            {error}
          </Text>
        )}

        {!otpSent ? (
          <Pressable
            style={[styles.submit, (!phone || submitting) && styles.disabled]}
            onPress={handleRequestOtp}
            disabled={!phone || submitting}
          >
            <Text style={styles.submitText}>{submitting ? t('auth.sendingOtp') : t('auth.sendOtp')}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[styles.submit, (!otp || submitting) && styles.disabled]}
              onPress={handleVerifyOtp}
              disabled={!otp || submitting}
            >
              <Text style={styles.submitText}>{submitting ? t('auth.verifyingOtp') : t('auth.verifyAndSignIn')}</Text>
            </Pressable>
            <Pressable onPress={initialPhone ? (onChangePhone ?? onBack) : () => setOtpSent(false)} style={styles.linkButton}>
              <Text style={styles.linkText}>{t('auth.changePhoneNumber')}</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={onUsePassword} style={styles.linkButton}>
          <Text style={styles.linkText}>{t('auth.useUsernamePassword')}</Text>
        </Pressable>
        {onRegister && (
          <Pressable onPress={onRegister} style={styles.linkButton}>
            <Text style={styles.linkText}>{t('auth.newHereCreateAccount')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  // Top edge set from the safe-area inset at render time: a fixed offset left most of the button
  // under the status bar, where taps never reach the app.
  backButton: {
    position: 'absolute',
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
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', paddingHorizontal: spacing.lg, textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  formScroll: { flex: 1 },
  form: { padding: spacing.lg, paddingTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  otpHint: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.sm },
  pendingNotice: { color: colors.warning, fontWeight: '600' },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  linkButton: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { color: colors.primary, fontWeight: '600' },
});
