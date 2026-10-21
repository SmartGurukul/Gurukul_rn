import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMyAiMisuse, type AiMyMisuseEvent } from '../api/ai';
import { getErrorMessage } from '../api/errorMessage';
import { useBottomInset } from '../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import { categoryLabelKey, featureLabelKey } from '../utils/aiGuard';
import { formatExpenseTime } from '../utils/expenses';
import { ErrorNotice } from './ErrorNotice';

/**
 * "What was recorded about me": the user's own refused AI messages of the last 30 days, as their
 * school sees them (GET /ai/misuse/mine - owner and school come from the login, so it can only be
 * their own). Read each time it opens. A server without the endpoint shows the empty state.
 */
export function AiMyRecordsSheet({ schoolId, visible, onClose }: { schoolId: string; visible: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const sheetBottom = useBottomInset();
  const [rows, setRows] = useState<AiMyMisuseEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cleared on closing, so the next opening starts from the spinner and reads the list again.
  const close = () => {
    setRows(null);
    setError(null);
    onClose();
  };

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getMyAiMisuse(schoolId)
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch((e) => {
        if (!cancelled) setError(getErrorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [visible, schoolId]);

  const renderRow = ({ item }: { item: AiMyMisuseEvent }) => {
    const featureKey = featureLabelKey(item.feature);
    return (
      <View style={styles.row}>
        <Text style={styles.meta}>
          {[formatExpenseTime(item.createdAt, i18n.language), featureKey ? t(featureKey) : item.feature].join(' · ')}
        </Text>
        <Text style={styles.category}>{t(categoryLabelKey(item.category))}</Text>
        <Text style={styles.excerpt}>{item.excerpt}</Text>
        {!item.counted ? <Text style={styles.notCounted}>{t('ai.myRecords.notCounted')}</Text> : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.sheet, { paddingBottom: sheetBottom }]} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('ai.myRecords.title')}</Text>
          <Text style={styles.intro}>{t('ai.myRecords.intro')}</Text>

          {error ? <ErrorNotice message={error} /> : null}
          {!error && rows === null ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}
          {rows !== null ? (
            <FlatList
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              data={rows}
              keyExtractor={(item, index) => `${item.createdAt}-${index}`}
              renderItem={renderRow}
              ListEmptyComponent={<Text style={styles.empty}>{t('ai.myRecords.empty')}</Text>}
            />
          ) : null}

          <Pressable style={styles.close} onPress={close} accessibilityRole="button">
            <Text style={styles.closeText}>{t('ai.myRecords.close')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  intro: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 18 },
  loader: { marginVertical: spacing.lg },
  list: { flexGrow: 0 },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.lg },
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  meta: { fontSize: 12, color: colors.textMuted },
  category: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  excerpt: { fontSize: 13, color: colors.textSecondary },
  notCounted: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  close: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  closeText: { color: colors.textPrimary, fontWeight: '700' },
});
