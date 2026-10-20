import { FontAwesome5 } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing, tints, type TintKey } from '../theme/colors';
import { fonts } from '../theme/typography';
import type { FeatureAction } from '../types/principal';

interface FeatureTileProps {
  feature: FeatureAction;
  onPress: () => void;
  /** The block's tint; a grid cycles the four with `tintAt(index)`. */
  tint?: TintKey;
}

/** A tool on the home grid: a tinted block with the icon in a white square. */
export function FeatureTile({ feature, onPress, tint = 'violet' }: FeatureTileProps) {
  const t = tints[tint];
  return (
    <TouchableOpacity style={[styles.tile, { backgroundColor: t.bg }]} onPress={onPress} activeOpacity={0.75} accessibilityRole="button">
      <View style={styles.iconTile}>
        <FontAwesome5 name={feature.icon} size={18} color={t.fg} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {feature.title}
      </Text>
      <Text style={[styles.description, { color: t.fg }]} numberOfLines={2}>
        {feature.description}
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
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
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
