import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listFeeStructures } from '../../api/feeStructures';
import type { FeeStructure } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeStructuresList'>;

function totalOf(structure: FeeStructure) {
  return structure.lines.reduce((sum, line) => sum + line.amount, 0);
}

export function FeeStructuresListScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError(null);
    return listFeeStructures(schoolId)
      .then(setStructures)
      .catch((e) => {
        setError(getErrorMessage(e));
        showToast(getErrorMessage(e), 'error');
      });
  }, [schoolId, showToast]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('fees.structuresList.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('FeeStructureForm')}>
          <Text style={styles.addButtonText}>{t('fees.structuresList.addButton')}</Text>
        </Pressable>

        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={structures}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>
                {error ? t('fees.structuresList.loadError') : t('fees.structuresList.empty')}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('FeeStructureDetail', { feeStructure: item })}
            >
              <View>
                <Text style={styles.rowName}>
                  {t('fees.structuresList.rowTitle', {
                    className: item.className,
                    section: item.section,
                    academicYear: item.academicYear,
                  })}
                </Text>
                <Text style={styles.rowMeta}>{t('fees.structuresList.feeLineCount', { count: item.lines.length })}</Text>
              </View>
              <Text style={styles.rowTotal}>₹{totalOf(item).toLocaleString('en-IN')}</Text>
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  loader: { marginTop: 40 },
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
  rowTotal: { fontSize: 14, color: accents.fees.base, fontWeight: '800' },
});
