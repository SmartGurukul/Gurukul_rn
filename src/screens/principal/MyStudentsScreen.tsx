import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { listClassSections } from '../../api/classSections';
import { listSectionSubjects } from '../../api/sectionSubjects';
import type { ClassSection } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'MyStudents'>;

const accent = accents.students;

export function MyStudentsScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listClassSections(schoolId)
      .then((all) =>
        Promise.all(
          all.map((cs) =>
            listSectionSubjects(schoolId, cs.id)
              .then((assignments) => ({ cs, teaches: assignments.some((a) => a.teacherId === session.ownerId) }))
              .catch(() => ({ cs, teaches: false }))
          )
        )
      )
      .then((rows) =>
        setSections(rows.filter((r) => r.teaches || r.cs.classTeacherId === session.ownerId).map((r) => r.cs))
      )
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, session.ownerId]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="My Students" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {error && <ErrorNotice message={error} />}
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={sections}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {error ? 'Could not load your classes.' : "You aren't assigned to any class yet."}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('SectionStudentsList', { classSection: item })}>
              <View style={styles.accentBar} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  {item.className} - {item.section}
                </Text>
                <Text style={styles.rowDescription}>{item.academicYear}</Text>
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
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...softShadow,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    backgroundColor: accent.base,
    marginRight: spacing.md,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowDescription: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  chevron: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
});
