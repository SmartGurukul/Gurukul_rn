import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, type AccentKey } from '../theme/colors';
import { fonts } from '../theme/typography';

interface Props {
  name: string;
  accentKey: AccentKey;
  size?: number;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) ?? '?';
  return initials.toUpperCase();
}

// `accentKey` is kept for callers; the redesign gives every avatar the same violet tile.
export function AvatarBadge({ name, size = 44 }: Props) {

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: radius.lg, backgroundColor: colors.primaryLight },
      ]}
    >
      <Text style={[styles.text, { color: colors.primary, fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fonts.headingMedium,
  },
});
