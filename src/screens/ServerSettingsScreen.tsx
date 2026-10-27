import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { currentServerUrl, defaultServerUrl, saveServerUrlOverride } from '../api/serverUrl';
import { ErrorNotice } from '../components/ErrorNotice';
import LabeledInput from '../components/LabeledInput';
import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing, tints } from '../theme/colors';
import { fonts } from '../theme/typography';

interface Props {
  onBack: () => void;
}

/**
 * Preview bundles only (see canOverrideServer): points the app at a laptop's backend for the AI
 * Tutor preview. Reached from the "Server" link at the bottom of the first screen. Store builds
 * never show the link, and never read an override.
 */
export default function ServerSettingsScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(currentServerUrl());
  const [url, setUrl] = useState(current === defaultServerUrl() ? '' : current);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const isDefault = current === defaultServerUrl();

  const apply = async (value: string) => {
    setError(null);
    setSaved(false);
    try {
      await saveServerUrlOverride(value);
      const now = currentServerUrl();
      setCurrent(now);
      setUrl(now === defaultServerUrl() ? '' : now);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('tutor.server.title')} subtitle={t('tutor.server.subtitle')} onBack={onBack} />
      <ScreenContainer contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.currentBlock}>
          <Text style={styles.currentLabel}>{t('tutor.server.current')}</Text>
          <Text style={styles.currentValue} selectable>
            {current}
          </Text>
          <Text style={styles.currentHint}>{isDefault ? t('tutor.server.usingDefault') : t('tutor.server.usingOverride')}</Text>
        </View>

        <LabeledInput
          label={t('tutor.server.urlLabel')}
          value={url}
          onChangeText={(text) => {
            setUrl(text);
            setSaved(false);
          }}
          placeholder="http://192.168.1.10:8080"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          onSubmitEditing={() => apply(url)}
        />
        <Text style={styles.help}>{t('tutor.server.help')}</Text>

        {error && <ErrorNotice message={error} />}
        {saved && !error && <Text style={styles.saved}>{t('tutor.server.saved')}</Text>}

        <Pressable style={[styles.primary, !url.trim() && styles.disabled]} onPress={() => apply(url)} disabled={!url.trim()}>
          <Text style={styles.primaryText}>{t('common.save')}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => apply('')}>
          <Text style={styles.secondaryText}>{t('tutor.server.useDefault')}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  currentBlock: {
    backgroundColor: tints.sky.bg,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: 2,
  },
  currentLabel: { fontFamily: fonts.body, fontSize: 12, color: tints.sky.fg },
  currentValue: { fontFamily: fonts.headingMedium, fontSize: 16, color: colors.textPrimary },
  currentHint: { fontFamily: fonts.body, fontSize: 12, color: tints.sky.fg },
  help: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.md },
  saved: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.success, marginBottom: spacing.sm },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryText: { color: colors.white, fontFamily: fonts.headingMedium, fontSize: 16 },
  disabled: { opacity: 0.5 },
  secondary: { marginTop: spacing.md, alignItems: 'center', paddingVertical: spacing.sm },
  secondaryText: { color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: 15 },
});
