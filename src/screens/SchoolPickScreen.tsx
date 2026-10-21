import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { SchoolSearchResult } from '../api/types';
import { ScreenHeader } from '../components/ScreenHeader';
import { useBottomInset } from '../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../theme/colors';

interface Props {
  /** The number the first screen looked up, and the schools that know it (two or more). */
  phone: string;
  schools: SchoolSearchResult[];
  onBack: () => void;
  onSelect: (school: SchoolSearchResult) => void;
}

/**
 * The only time the app asks which school: a number on file at more than one. Just those
 * schools, no directory - there is nothing to search for that the number hasn't already found.
 */
export default function SchoolPickScreen({ phone, schools, onBack, onSelect }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('schoolPick.title')}
        subtitle={t('schoolPick.registeredWith', { phone, count: schools.length })}
        onBack={onBack}
      />
      <View style={styles.body}>
        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={schools}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => onSelect(item)}>
              <View>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.city}, {item.state}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
});
