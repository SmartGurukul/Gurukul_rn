import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The violet field at the top of the pre-auth screens (sign in, register, profile pick): solid
 * Violet 700 with one decorative Violet 600 circle, no gradient. Pass the screen's own padding
 * and radius in `style`.
 */
export function VioletHero({ children, style }: Props) {
  return (
    <View style={[styles.field, style]}>
      <View style={styles.circle} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { backgroundColor: colors.primary, overflow: 'hidden' },
  circle: {
    position: 'absolute',
    right: -70,
    top: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.primaryBright,
  },
});
