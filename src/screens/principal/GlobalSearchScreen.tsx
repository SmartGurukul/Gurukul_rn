import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { isActiveEmployee, searchEmployees } from '../../api/employees';
import { searchStudents } from '../../api/students';
import type { Employee, Student } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { useSchoolId } from '../../context/SchoolContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'GlobalSearch'>;

type Result = { kind: 'STUDENT'; item: Student } | { kind: 'EMPLOYEE'; item: Employee };

export function GlobalSearchScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim());
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([searchStudents(schoolId, debouncedQuery), searchEmployees(schoolId, debouncedQuery)])
      .then(([students, employees]) => {
        setResults([
          ...students.map((item): Result => ({ kind: 'STUDENT', item })),
          ...employees.filter(isActiveEmployee).map((item): Result => ({ kind: 'EMPLOYEE', item })),
        ]);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, debouncedQuery]);

  const resultKey = (result: Result) => `${result.kind}:${result.item.id}`;

  const handlePress = (result: Result) => {
    if (result.kind === 'STUDENT') navigation.navigate('StudentDetail', { student: result.item });
    else navigation.navigate('EmployeeDetail', { employee: result.item });
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Search" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search students, staff…" />
        {loading && <ActivityIndicator color={colors.primary} />}
        {error && <ErrorNotice message={error} />}
        {!loading && debouncedQuery && results.length === 0 && !error && (
          <Text style={styles.empty}>No results for &quot;{debouncedQuery}&quot;.</Text>
        )}
        {!debouncedQuery && <Text style={styles.empty}>Start typing to search across students and staff.</Text>}
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={results}
          scrollEnabled={false}
          keyExtractor={resultKey}
          renderItem={({ item: result }) => (
            <Pressable style={styles.row} onPress={() => handlePress(result)}>
              <View>
                <Text style={styles.rowTitle}>{result.item.name}</Text>
                <Text style={styles.rowSubtitle}>
                  {result.kind === 'STUDENT'
                    ? `Student · ${result.item.classSectionLabel}`
                    : `Staff · ${result.item.designation}`}
                </Text>
              </View>
              <Text style={styles.kindBadge}>{result.kind === 'STUDENT' ? 'Student' : 'Staff'}</Text>
            </Pressable>
          )}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  error: { color: colors.error, fontSize: 13, marginBottom: spacing.md },
  empty: { color: colors.textMuted, marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  kindBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
});
