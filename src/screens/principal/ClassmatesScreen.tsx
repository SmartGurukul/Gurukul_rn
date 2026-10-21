import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getStudent, listAllStudents } from '../../api/students';
import type { Student } from '../../api/types';
import { AvatarBadge } from '../../components/AvatarBadge';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Classmates'>;

export function ClassmatesScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [classmates, setClassmates] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getStudent(schoolId, session.ownerId)
      .then((me) => listAllStudents(schoolId).then((students) => ({ me, students })))
      .then(({ me, students }) => {
        setClassmates(students.filter((s) => s.className === me.className && s.academicYear === me.academicYear));
        setSection(me.section);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, session.ownerId]);

  const sections = Array.from(new Set(classmates.map((s) => s.section))).sort();

  const visible = classmates
    .filter((s) => !section || s.section === section)
    .filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <View style={styles.root}>
      <ScreenHeader title="My Classmates" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by name" />

        {sections.length > 0 && (
          <View style={styles.chips}>
            <Pressable style={[styles.chip, section === null && styles.chipSelected]} onPress={() => setSection(null)}>
              <Text style={[styles.chipText, section === null && styles.chipTextSelected]}>All</Text>
            </Pressable>
            {sections.map((s) => (
              <Pressable key={s} style={[styles.chip, section === s && styles.chipSelected]} onPress={() => setSection(s)}>
                <Text style={[styles.chipText, section === s && styles.chipTextSelected]}>Section {s}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {error && <ErrorNotice message={error} />}
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={visible}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {error ? 'Could not load classmates.' : query ? 'No match found.' : 'No classmates found.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('StudentDetail', { student: item })}>
              <AvatarBadge name={item.name} accentKey="students" />
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  Roll {item.rollNumber} · Section {item.section}
                </Text>
              </View>
              <StatusChip label={item.status} variant={item.status === 'ACTIVE' ? 'success' : 'neutral'} />
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
