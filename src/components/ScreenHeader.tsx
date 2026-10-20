import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageSwitch } from './LanguageSwitch';
import { colors, radius, spacing, tints } from '../theme/colors';
import { fonts } from '../theme/typography';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  /** Set false to omit the leading initial-letter tile on a root screen (no onBack). Defaults to true. */
  showBadge?: boolean;
  /** Rendered under the title row (a day picker, a segmented control, a child switcher, ...). */
  children?: ReactNode;
  /** Kept for callers from the previous design; the light header has nothing to overlap. */
  overlap?: number;
}

/**
 * The light header of the Playful Blocks design: paper ground, dark title, a white round back
 * button (or a violet initial tile on a root screen), the screen's actions on the right.
 */
export function ScreenHeader({ title, subtitle, onBack, rightAction, showBadge = true, children }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const initial = (title ?? '').trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
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

/** A white round header button, for a screen's own right-hand actions. */
export const headerButtonStyle = {
  width: 44,
  height: 44,
  borderRadius: radius.lg,
  backgroundColor: colors.surface,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backButton: { ...headerButtonStyle },
  backText: {
    color: colors.textPrimary,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: fonts.headingMedium,
    marginTop: -3,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: tints.violet.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: tints.violet.fg,
    fontSize: 16,
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
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.heading,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  children: {
    marginTop: spacing.md,
  },
});
