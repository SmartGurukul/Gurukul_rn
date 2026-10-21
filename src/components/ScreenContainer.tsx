import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';

import { useBottomInset } from '../hooks/useBottomInset';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { colors, spacing } from '../theme/colors';

interface ScreenContainerProps extends ScrollViewProps {
  children: ReactNode;
  padded?: boolean;
  /** Pad the end of the content past the system bottom bar. Set false when a footer below handles it. */
  bottomInset?: boolean;
}

export function ScreenContainer({
  children,
  padded = true,
  bottomInset = true,
  contentContainerStyle,
  ...props
}: ScreenContainerProps) {
  const bottomPadding = useBottomInset(padded ? spacing.lg : 0);
  // While the keyboard is open the content gets that much more room at the end, so the field being
  // edited and the Save button under it can always be scrolled into view.
  const keyboardInset = useKeyboardInset();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        padded && styles.padded,
        bottomInset && { paddingBottom: bottomPadding },
        contentContainerStyle,
        keyboardInset > 0 && { paddingBottom: (bottomInset ? bottomPadding : padded ? spacing.lg : 0) + keyboardInset },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenBody({ children }: { children: ReactNode }) {
  return <View style={styles.body}>{children}</View>;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
  },
  padded: {
    padding: spacing.lg,
  },
  body: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
