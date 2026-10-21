import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listSectionsByClass } from '../../api/classSections';
import type { ClassSection } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SectionsList'>;

export function SectionsListScreen({ route, navigation }: Props) {
  const listBottom = useBottomInset();
  const schoolId = useSchoolId();
  const { className } = route.params;
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return listSectionsByClass(schoolId, className)
      .then(setSections)
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId, className]);

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
      <ScreenHeader title={className} subtitle="Sections" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {error && <ErrorNotice message={error} />}
        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={sections}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>{error ? 'Could not load sections.' : 'No sections found.'}</Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('SectionDetail', { classSection: item })}>
              <View>
                <Text style={styles.rowName}>Section {item.section}</Text>
                <Text style={styles.rowMeta}>{item.academicYear}</Text>
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
  error: { color: colors.error, marginBottom: spacing.md },
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
  chevron: { fontSize: 22, color: colors.textMuted },
});
