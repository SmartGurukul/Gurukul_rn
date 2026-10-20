import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { BASE_URL } from '../../api/client';
import type { PublicTracking } from '../../api/types';
import { BusMap } from '../../components/BusMap';
import { VioletHero } from '../../components/VioletHero';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import { formatAgo, formatTime } from '../../transport/labels';

const POLL_MS = 10_000;

/**
 * Opened from a WhatsApp "track the bus" link when the app is installed. Shows the same live map
 * as the link's web page, using the link's own secret - so it works whichever family profile is
 * signed in (or none), and stops showing the bus once the child is off it.
 */
export function TrackLinkView({ token, onClose }: { token: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PublicTracking | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(() => {
    fetch(`${BASE_URL}/track/${encodeURIComponent(token)}/data`, { headers: { Accept: 'application/json' } })
      .then((res) => res.json() as Promise<PublicTracking>)
      .then((next) => {
        setData(next);
        setOffline(false);
      })
      .catch(() => setOffline(true));
  }, [token]);

  const onBus = data?.state === 'ON_BUS';
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (data && !onBus) return;
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load, data, onBus]);

  const toSchool = data?.direction === 'MORNING';
  const location = data?.location ?? null;

  return (
    <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <VioletHero style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              {data?.schoolName ? <Text style={styles.school}>{data.schoolName}</Text> : null}
              <Text style={styles.title} numberOfLines={2}>
                {data?.childName ? `${data.childName} · ${data.busName}` : t('transport.trackLink.title')}
              </Text>
              {onBus ? (
                <Text style={styles.sub}>
                  {t(`transport.direction.${toSchool ? 'MORNING' : 'RETURN'}`)}
                  {data?.busRegistrationNumber ? ` · ${data.busRegistrationNumber}` : ''}
                </Text>
              ) : null}
            </View>
            <Pressable style={styles.close} onPress={onClose} accessibilityRole="button">
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
        </VioletHero>

        <View style={styles.body}>
          {!data && !offline && <ActivityIndicator color={colors.primary} style={styles.loading} />}
          {data?.state === 'INVALID' && <Card icon="🔗" text={t('transport.trackLink.invalid')} />}
          {data?.state === 'ENDED' && <Card icon="✅" text={t('transport.trackLink.ended')} />}
          {data?.state === 'DROPPED' && (
            <Card
              icon="🏠"
              text={t('transport.trackLink.dropped', {
                name: data.childName ?? '',
                time: formatTime(data.droppedAt ?? null, i18n.language),
              })}
            />
          )}
          {onBus && (
            <>
              <BusMap location={location} height={460} />
              <Text style={styles.updated}>
                {location
                  ? t('transport.myBus.lastUpdated', { ago: formatAgo(location.at, t) })
                  : t('transport.myBus.noLocationYet')}
              </Text>
            </>
          )}
          {offline && <Text style={styles.updated}>{t('transport.trackLink.offline')}</Text>}
        </View>
      </View>
    </Modal>
  );
}

function Card({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardIcon}>{icon}</Text>
      <Text style={styles.cardText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headerText: { flex: 1, marginRight: spacing.md },
  school: { color: colors.textSecondary, fontSize: 13 },
  title: { color: colors.textPrimary, fontSize: 19, fontWeight: '800', marginTop: 2 },
  sub: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  close: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  body: { flex: 1, padding: spacing.lg },
  loading: { marginTop: spacing.xl },
  updated: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  cardIcon: { fontSize: 40, marginBottom: spacing.sm },
  cardText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
});
