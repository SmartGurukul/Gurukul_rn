import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '../i18n/useLanguage';
import { colors, radius, shadow, spacing } from '../theme/colors';
import { fonts } from '../theme/typography';

export function LanguageSwitch() {
  const { language, languages, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <Pressable
        style={styles.badge}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Change language"
      >
        <Text style={styles.badgeText}>{language.toUpperCase()}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: insets.top + 64 }]}>
            {languages.map((lang) => (
              <Pressable
                key={lang.code}
                style={[styles.option, lang.code === language && styles.optionActive]}
                onPress={() => {
                  setLanguage(lang.code);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, lang.code === language && styles.optionTextActive]}>
                  {lang.nativeLabel}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: fonts.headingMedium,
  },
  backdrop: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    minWidth: 140,
    ...shadow,
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  optionActive: {
    backgroundColor: colors.primaryLight,
  },
  optionText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
