import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectProfile } from '../api/auth';
import { ApiError, setAuthSession } from '../api/client';
import type { Session } from '../api/authStorage';
import type { AuthProfile } from '../api/types';
import { Logo } from '../components/Logo';
import { VioletHero } from '../components/VioletHero';
import { ProfileCard } from '../components/ProfileCard';
import { colors, radius, spacing } from '../theme/colors';
import { getErrorMessage } from '../api/errorMessage';
import { ErrorNotice } from '../components/ErrorNotice';

interface Props {
  schoolId: string;
  schoolName?: string;
  selectionToken: string;
  profiles: AuthProfile[];
  onSelected: (session: Session) => void;
  onBack: () => void;
}

export default function ProfileSelectScreen({ schoolId, schoolName, selectionToken, profiles, onSelected, onBack }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const handleSelect = async (profile: AuthProfile) => {
    setSelectingId(profile.ownerId);
    setError(null);
    try {
      const session = await selectProfile(schoolId, {
        selectionToken,
        ownerType: profile.ownerType,
        ownerId: profile.ownerId,
      });
      setAuthSession(session);
      onSelected(session);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setExpired(true);
      } else if (e instanceof ApiError && e.status === 403) {
        setError(t('auth.profileNotLinked'));
      } else {
        setError(getErrorMessage(e));
      }
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <View style={styles.root}>
      <VioletHero style={styles.hero}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Logo width={100} onDarkBackground />
        <Text style={styles.title}>{t('auth.whoIsUsingApp')}</Text>
        <Text style={styles.subtitle}>{schoolName ?? t('auth.chooseProfileSubtitle')}</Text>
      </VioletHero>

      <View style={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}>
        {expired ? (
          <View style={styles.expiredBox}>
            <ErrorNotice message={t('auth.selectionExpired')} />
            <Pressable style={styles.retryButton} onPress={onBack}>
              <Text style={styles.retryButtonText}>{t('common.back')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {error && <ErrorNotice message={error} />}
            {profiles.map((profile) => (
              <ProfileCard
                key={`${profile.ownerType}:${profile.ownerId}`}
                profile={profile}
                onPress={() => handleSelect(profile)}
                disabled={selectingId !== null}
              />
            ))}
            {selectingId && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xl,
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
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  title: { color: colors.white, fontSize: 20, fontWeight: '800', marginTop: spacing.sm, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: spacing.lg },
  list: { flex: 1, padding: spacing.lg },
  error: { color: colors.error, marginBottom: spacing.md, textAlign: 'center' },
  spinner: { marginTop: spacing.sm },
  expiredBox: { alignItems: 'center', marginTop: spacing.xl },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  retryButtonText: { color: colors.white, fontWeight: '700' },
});
