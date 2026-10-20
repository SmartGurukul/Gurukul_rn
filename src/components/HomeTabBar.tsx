import { FontAwesome5 } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, tints } from '../theme/colors';
import { fonts } from '../theme/typography';

export interface HomeTab {
  key: string;
  label: string;
  icon: string;
  onPress?: () => void;
}

interface Props {
  tabs: HomeTab[];
  activeKey: string;
}

export const HOME_TAB_BAR_HEIGHT = 60;

/**
 * The bottom tab bar of the Deep Violet home. It lives on the home screen only for now (the
 * app's screens are one native stack), so every tab but Home pushes its screen; the real tab
 * navigator is a later step of the redesign.
 */
export function HomeTabBar({ tabs, activeKey }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.sm }]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        const color = active ? colors.primary : colors.textSecondary;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={tab.onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <FontAwesome5 name={tab.icon} size={20} color={color} />
            </View>
            <Text style={[styles.label, { color, fontFamily: active ? fonts.bodySemibold : fonts.body }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: HOME_TAB_BAR_HEIGHT - spacing.sm },
  iconWrap: { width: 56, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: tints.violet.bg },
  label: { fontSize: 11, lineHeight: 14 },
});
