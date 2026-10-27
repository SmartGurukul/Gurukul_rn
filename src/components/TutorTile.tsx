import { FontAwesome5 } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getMyTutorAccess } from '../api/tutor';
import type { TutorAccess } from '../api/types';
import { colors, radius, spacing, tints } from '../theme/colors';
import { fonts } from '../theme/typography';

interface Props {
  schoolId: string;
  onPress: () => void;
}

/**
 * The AI Tutor tile on a student's home: a violet block like the other tools, with a "Premium"
 * chip until the school switches the tutor on for this student. Access loads lazily and quietly:
 * the tile opens the chapters screen either way, which explains a locked state properly.
 */
export function TutorTile({ schoolId, onPress }: Props) {
  const { t } = useTranslation();
  const [access, setAccess] = useState<TutorAccess | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyTutorAccess(schoolId)
      .then((a) => {
        if (!cancelled) setAccess(a);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const premium = access !== null && !access.allowed;
  const tint = tints.violet;

  return (
    <TouchableOpacity
      style={[styles.tile, { backgroundColor: tint.bg }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={t('tutor.tile.title')}
    >
      <View style={styles.topRow}>
        <View style={styles.iconTile}>
          <FontAwesome5 name="robot" size={18} color={tint.fg} />
        </View>
        {premium && (
          <View style={styles.premiumChip}>
            <FontAwesome5 name="crown" size={9} color={colors.warning} />
            <Text style={styles.premiumText}>{t('tutor.tile.premium')}</Text>
          </View>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {t('tutor.tile.title')}
      </Text>
      <Text style={[styles.description, { color: tint.fg }]} numberOfLines={2}>
        {t('tutor.tile.description')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warningLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  premiumText: { fontFamily: fonts.bodySemibold, fontSize: 11, lineHeight: 14, color: colors.warning },
  title: {
    fontFamily: fonts.headingMedium,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 17,
  },
});
