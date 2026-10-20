import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { publicSignup, requestPublicOtp } from '../api/auth';
import { getErrorMessage } from '../api/errorMessage';
import type { Session } from '../api/authStorage';
import { PUBLIC_CLASSES } from '../config/publicSchool';
import { ErrorNotice } from '../components/ErrorNotice';
import LabeledInput from '../components/LabeledInput';
import { Logo } from '../components/Logo';
import { VioletHero } from '../components/VioletHero';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import { normalizePhone } from '../utils/phoneLogin';

interface Props {
  initialPhone?: string;
  onLoggedIn: (session: Session) => void;
  onBack: () => void;
}

/**
 * A phone registered at no school can still learn here: pick a class, verify a code, and get a
 * schoolless "public" student session (Resources + Gamification). The virtual Open School is never
 * named in the UI - this screen only ever asks for a name and a class.
 */
export default function PublicSignupScreen({ initialPhone, onLoggedIn, onBack }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<number | null>(null);
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = !!name.trim() && grade != null && !!normalizePhone(phone) && !busy;

  const sendCode = async () => {
    const number = normalizePhone(phone);
    if (!number || !name.trim() || grade == null) return;
    setBusy(true);
    setError(null);
    try {
      await requestPublicOtp({ phone: number });
      setSent(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const number = normalizePhone(phone);
    if (!number || !otp.trim() || grade == null) return;
    setBusy(true);
    setError(null);
    try {
      const session = await publicSignup({ phone: number, otp: otp.trim(), name: name.trim(), grade });
      onLoggedIn(session);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <VioletHero style={styles.hero}>
        <Logo width={150} />
        <Text style={styles.title}>{t('publicLogin.title')}</Text>
        <Text style={styles.subtitle}>{t('publicLogin.subtitle')}</Text>
      </VioletHero>

      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + spacing.xl }]}>
        {!sent ? (
          <>
            <LabeledInput label={t('publicLogin.nameLabel')} value={name} onChangeText={setName} autoCapitalize="words" />
            <LabeledInput
              label={t('auth.phoneNumber')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <Text style={styles.classPrompt}>{t('publicLogin.classPrompt')}</Text>
            <View style={styles.classGrid}>
              {PUBLIC_CLASSES.map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGrade(g)}
                  style={[styles.classChip, grade === g && styles.classChipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: grade === g }}
                >
                  <Text style={[styles.classChipText, grade === g && styles.classChipTextOn]}>{g}</Text>
                </Pressable>
              ))}
            </View>

            {error && <ErrorNotice message={error} />}

            <Pressable style={[styles.submit, !canSend && styles.disabled]} onPress={sendCode} disabled={!canSend}>
              <Text style={styles.submitText}>{busy ? t('publicLogin.sending') : t('publicLogin.sendCode')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.codeSentTo}>{t('publicLogin.codeSentTo', { phone: normalizePhone(phone) })}</Text>
            <LabeledInput
              label={t('publicLogin.otpLabel')}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={verify}
            />
            {error && <ErrorNotice message={error} />}
            <Pressable style={[styles.submit, (!otp.trim() || busy) && styles.disabled]} onPress={verify} disabled={!otp.trim() || busy}>
              <Text style={styles.submitText}>{busy ? t('publicLogin.verifying') : t('publicLogin.verify')}</Text>
            </Pressable>
            <Pressable onPress={() => setSent(false)} style={styles.linkButton}>
              <Text style={styles.linkText}>{t('publicLogin.editDetails')}</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={onBack} style={styles.linkButton}>
          <Text style={styles.linkText}>{t('common.back')}</Text>
        </Pressable>
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
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: spacing.md, textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.lg },
  form: { padding: spacing.lg, gap: spacing.md },
  classPrompt: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: spacing.xs },
  classGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  classChip: {
    width: 56,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    ...softShadow,
  },
  classChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  classChipText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  classChipTextOn: { color: colors.white },
  codeSentTo: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  linkButton: { alignItems: 'center', paddingVertical: spacing.sm },
  linkText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
});
