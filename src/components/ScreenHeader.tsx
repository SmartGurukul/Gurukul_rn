import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageSwitch } from './LanguageSwitch';
import { colors, radius, spacing } from '../theme/colors';
import { fonts } from '../theme/typography';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  /** Set false to omit the leading initial-letter badge on a root screen (no onBack). Defaults to true. */
  showBadge?: boolean;
  /** Rendered inside the violet surface under the title row (a day picker, a key number, ...). */
  children?: ReactNode;
  /**
   * Extra bottom padding so the first card of the screen can overlap the header (the design's
   * "hero card": give the card a negative top margin of the same size). Defaults to none.
   */
  overlap?: number;
}

/**
 * The solid Violet 700 header of the Deep Violet design: title and subtitle in white, one
 * decorative Violet 600 circle, no gradient and no shadow.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  showBadge = true,
  children,
  overlap = 0,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const initial = (title ?? '').trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl + overlap }]}>
      <View style={styles.circle} pointerEvents="none" />
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.badge} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
        ) : showBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{initial}</Text>
          </View>
        ) : null}
        <View style={styles.titleBlock}>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <View style={styles.rightActionWrap}>{rightAction ?? <LanguageSwitch />}</View>
      </View>
      {children ? <View style={styles.children}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    right: -60,
    top: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primaryBright,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  backText: {
    color: colors.onPrimary,
    fontSize: 26,
    lineHeight: 30,
    fontFamily: fonts.headingMedium,
    marginTop: -2,
  },
  badgeText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontFamily: fonts.headingMedium,
  },
  titleBlock: {
    flex: 1,
    flexShrink: 1,
    overflow: 'hidden',
  },
  rightActionWrap: {
    flexShrink: 0,
  },
  title: {
    color: colors.onPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.heading,
  },
  subtitle: {
    color: colors.onPrimaryMuted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  children: {
    marginTop: spacing.md,
  },
});
