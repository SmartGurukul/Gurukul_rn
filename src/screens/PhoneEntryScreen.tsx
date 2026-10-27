import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardInset } from '../hooks/useKeyboardInset';

import { lookupSchoolsByPhone } from '../api/auth';
import { canOverrideServer } from '../api/serverUrl';
import { getErrorMessage } from '../api/errorMessage';
import type { SchoolSearchResult } from '../api/types';
import { ErrorNotice } from '../components/ErrorNotice';
import LabeledInput from '../components/LabeledInput';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { Logo } from '../components/Logo';
import { VioletHero } from '../components/VioletHero';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import { normalizePhone } from '../utils/phoneLogin';

interface Props {
  /** The number is on file at these schools (never empty); App picks between OTP and a school choice. */
  onSchoolsFound: (phone: string, schools: SchoolSearchResult[]) => void;
  onRegisterSchool: () => void;
  /** A number registered at no school can still learn as a schoolless (public) student. */
  onContinueAsPublic: (phone: string) => void;
  /** Preview bundles only: opens the Server screen (AI Tutor preview against a laptop's backend). */
  onOpenServer?: () => void;
}

/**
 * The first screen: the phone number, not the school. The server says which schools know the
 * number, and the school is only asked for when there is more than one. There is no school
 * directory to browse: a number registered nowhere is told so and stays here - its school has
 * to add it. The one other way in is registering a new school.
 */
export default function PhoneEntryScreen({ onSchoolsFound, onRegisterSchool, onContinueAsPublic, onOpenServer }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const [phone, setPhone] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);

  const handleContinue = async () => {
    const number = normalizePhone(phone);
    if (!number) return;
    setChecking(true);
    setError(null);
    setNotRegistered(false);
    try {
      const schools = await lookupSchoolsByPhone(number);
      if (schools.length === 0) {
        setNotRegistered(true);
        return;
      }
      onSchoolsFound(number, schools);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.root}>
      <VioletHero style={styles.hero}>
        <View style={[styles.languageSwitchWrapper, { top: insets.top + spacing.xs }]}>
          <LanguageSwitch />
        </View>
        <Logo width={160} />
        <Text style={styles.title}>{t('phoneLogin.title')}</Text>
        <Text style={styles.subtitle}>{t('phoneLogin.subtitle')}</Text>
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
          onChangeText={(text) => {
            setPhone(text);
            setNotRegistered(false);
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="done"
          onSubmitEditing={handleContinue}
        />

        {error && <ErrorNotice message={error} />}
        {notRegistered && (
          <View style={styles.notice} accessibilityRole="alert">
            <Text style={styles.noticeText}>{t('phoneLogin.notRegistered')}</Text>
            <Pressable
              style={styles.publicCta}
              onPress={() => onContinueAsPublic(normalizePhone(phone))}
            >
              <Text style={styles.publicCtaText}>{t('publicLogin.continueAsStudent')}</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={[styles.submit, (!phone.trim() || checking) && styles.disabled]}
          onPress={handleContinue}
          disabled={!phone.trim() || checking}
        >
          <Text style={styles.submitText}>{checking ? t('phoneLogin.checking') : t('phoneLogin.continue')}</Text>
        </Pressable>

        <Pressable onPress={onRegisterSchool} style={styles.linkButton}>
          <Text style={styles.linkText}>{t('welcome.registerSchool')}</Text>
        </Pressable>
        {onOpenServer && canOverrideServer() && (
          <Pressable onPress={onOpenServer} style={styles.serverLink} accessibilityRole="button">
            <Text style={styles.serverLinkText}>{t('tutor.server.link')}</Text>
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
  languageSwitchWrapper: {
    position: 'absolute',
    right: spacing.lg,
  },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: spacing.md, textAlign: 'center' },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  formScroll: { flex: 1 },
  form: { padding: spacing.lg, paddingTop: spacing.xl },
  notice: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noticeText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  publicCta: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  publicCtaText: { color: colors.white, fontWeight: '700', fontSize: 15 },
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
  serverLink: { marginTop: spacing.xl, alignItems: 'center' },
  serverLinkText: { color: colors.textMuted, fontSize: 12 },
});
