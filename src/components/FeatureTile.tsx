import { FontAwesome5 } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing } from '../theme/colors';
import { fonts } from '../theme/typography';
import type { FeatureAction } from '../types/principal';

interface FeatureTileProps {
  feature: FeatureAction;
  onPress: () => void;
}

/** A tool on the home grid: white card, Line border, violet icon tile - no per-feature colours. */
export function FeatureTile({ feature, onPress }: FeatureTileProps) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.75} accessibilityRole="button">
      <View style={styles.iconTile}>
        <FontAwesome5 name={feature.icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {feature.title}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {feature.description}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
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
    color: colors.textSecondary,
  },
});
