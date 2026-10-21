import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listClassNames } from '../../api/classSections';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ClassesList'>;

export function ClassesListScreen({ route, navigation }: Props) {
  const homeroom = route.params?.homeroom;
  const listBottom = useBottomInset();
  const schoolId = useSchoolId();
  const [classNames, setClassNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return listClassNames(schoolId)
      .then(setClassNames)
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId]);

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
      <ScreenHeader title="Classes" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {error && <ErrorNotice message={error} />}
        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={classNames}
          keyExtractor={(item) => item}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListHeaderComponent={
            // A class teacher's own section comes first - it replaces the separate My Class tile.
            homeroom ? (
              <Pressable
                style={[styles.row, styles.homeroomRow]}
                onPress={() => navigation.navigate('SectionDetail', { classSection: homeroom })}
              >
                <View style={styles.homeroomText}>
                  <Text style={styles.homeroomLabel}>My class</Text>
                  <Text style={styles.rowName}>
                    {homeroom.className} - {homeroom.section}
                  </Text>
                  <Text style={styles.homeroomMeta}>Attendance, fees, marks and report cards</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {error
                  ? 'Could not load classes.'
                  : '0 classes yet — a class appears here once a class-section is created for it (via Students → enroll/transfer).'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('SectionsList', { className: item })}>
              <Text style={styles.rowName}>{item}</Text>
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
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40, lineHeight: 20 },
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
  homeroomRow: { borderWidth: 1, borderColor: colors.primary, marginBottom: spacing.md },
  homeroomText: { flex: 1 },
  homeroomLabel: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  homeroomMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
});
