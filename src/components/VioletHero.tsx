import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, tints } from '../theme/colors';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The soft field at the top of the pre-auth screens (sign in, register, profile pick): white with
 * two tinted circles, dark text on top. Pass the screen's own padding and radius in `style`.
 * (The name is from the previous design; the field is no longer violet.)
 */
export function VioletHero({ children, style }: Props) {
  return (
    <View style={[styles.field, style]}>
      <View style={[styles.circle, styles.circleViolet]} pointerEvents="none" />
      <View style={[styles.circle, styles.circleMarigold]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { backgroundColor: colors.surface, overflow: 'hidden' },
  circle: { position: 'absolute', borderRadius: 999 },
  circleViolet: { right: -70, top: -50, width: 220, height: 220, backgroundColor: tints.violet.bg },
  circleMarigold: { left: -60, bottom: -80, width: 170, height: 170, backgroundColor: tints.marigold.bg },
});
