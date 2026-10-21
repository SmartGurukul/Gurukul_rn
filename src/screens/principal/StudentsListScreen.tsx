import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listStudents, searchStudents } from '../../api/students';
import type { Student } from '../../api/types';
import { AvatarBadge } from '../../components/AvatarBadge';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'StudentsList'>;

const ROW_HEIGHT = 76;
const PAGE_SIZE = 50;

const StudentRow = memo(function StudentRow({
  student,
  onPress,
}: {
  student: Student;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <AvatarBadge name={student.name} accentKey="students" />
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{student.name}</Text>
        <Text style={styles.rowMeta}>
          {t('students.list.rowSubtitle', {
            roll: student.rollNumber,
            classSection: student.classSectionLabel || t('common.unassigned'),
          })}
        </Text>
      </View>
      <StatusChip
        label={
          student.status === 'ACTIVE'
            ? t('common.active')
            : student.status === 'INACTIVE'
              ? t('common.inactive')
              : student.status
        }
        variant={student.status === 'ACTIVE' ? 'success' : 'neutral'}
      />
    </Pressable>
  );
});

export function StudentsListScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim());
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(
    (pageToLoad: number, append: boolean) => {
      setError(null);
      if (debouncedQuery) {
        return searchStudents(schoolId, debouncedQuery)
          .then((rows) => {
            setStudents(rows);
            setHasNext(false);
          })
          .catch((e) => {
            setError(getErrorMessage(e));
            showToast(getErrorMessage(e), 'error');
          });
      }
      return listStudents(schoolId, pageToLoad, PAGE_SIZE)
        .then((res) => {
          setStudents((prev) => (append ? [...prev, ...res.content] : res.content));
          setHasNext(res.hasNext);
          setPage(pageToLoad);
        })
        .catch((e) => {
          setError(getErrorMessage(e));
          showToast(getErrorMessage(e), 'error');
        });
    },
    [schoolId, debouncedQuery, showToast]
  );

  useEffect(() => {
    setLoading(true);
    load(0, false).finally(() => setLoading(false));
  }, [load]);

  const hasMounted = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Skip the initial focus event - the mount effect above already loads.
      if (!hasMounted.current) {
        hasMounted.current = true;
        return;
      }
      setLoading(true);
      load(0, false).finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(0, false).finally(() => setRefreshing(false));
  };

  const handleLoadMore = () => {
    if (!hasNext || loadingMore || debouncedQuery) return;
    setLoadingMore(true);
    load(page + 1, true).finally(() => setLoadingMore(false));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('students.list.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('StudentForm', {})}>
          <Text style={styles.addButtonText}>{t('students.list.addButton')}</Text>
        </Pressable>

        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by name or roll number" />

        {error && <ErrorNotice message={error} />}

        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={students}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          getItemLayout={(_, index) => ({
            length: ROW_HEIGHT,
            offset: ROW_HEIGHT * index,
            index,
          })}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>
                {error
                  ? t('students.list.loadError')
                  : debouncedQuery
                    ? t('students.list.noSearchResults')
                    : t('students.list.empty')}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <StudentRow student={item} onPress={() => navigation.navigate('StudentDetail', { student: item })} />
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
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  footerLoader: { marginVertical: spacing.md },
  loader: { marginTop: 40 },
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
