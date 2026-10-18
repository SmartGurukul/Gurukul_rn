import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getCurriculumSuggestions, setSubjectCurriculum } from '../../api/curriculumMapping';
import { getErrorMessage } from '../../api/errorMessage';
import { listSubjects } from '../../api/subjects';
import type { CurriculumSubjectRef, CurriculumSuggestions, Subject } from '../../api/types';
import Dropdown from '../../components/Dropdown';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'CurriculumMapping'>;

const accent = accents.resources;
/** The dropdown value that means "this school subject has no NCERT subject" (sent as null). */
const NONE = '__none__';
/** A suggestion below this is shown as a hint but not pre-selected. */
const CONFIDENT = 0.6;

interface Row {
  subject: Subject;
  suggestions: CurriculumSuggestions;
  /** What the dropdown shows; NONE or a curriculum subject key. */
  value: string;
  saving: boolean;
}

/**
 * Admin: link each school subject to the NCERT subject it is (Maths = Mathematics). One save per
 * row; the server pre-fills that subject's chapter list for every class the school has.
 */
export function CurriculumMappingScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<CurriculumSubjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const subjects = await listSubjects(schoolId);
      const suggestions = await Promise.all(subjects.map((s) => getCurriculumSuggestions(schoolId, s.id)));
      const all = suggestions.find((s) => s.allSubjects.length > 0)?.allSubjects ?? [];
      setOptions(all);
      setRows(
        subjects.map((subject, i) => {
          const s = suggestions[i];
          const top = s.suggestions[0];
          const value = s.current?.key ?? (top && top.score >= CONFIDENT ? top.key : NONE);
          return { subject, suggestions: s, value, saving: false };
        })
      );
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, [schoolId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  const save = async (row: Row) => {
    const key = row.value === NONE ? null : row.value;
    setRows((prev) => prev.map((r) => (r.subject.id === row.subject.id ? { ...r, saving: true } : r)));
    try {
      const result = await setSubjectCurriculum(schoolId, row.subject.id, key);
      const linked = options.find((o) => o.key === result.curriculumSubjectKey) ?? null;
      setRows((prev) =>
        prev.map((r) =>
          r.subject.id === row.subject.id
            ? { ...r, saving: false, suggestions: { ...r.suggestions, current: linked } }
            : r
        )
      );
      showToast(
        key ? t('curriculumMapping.linked', { count: result.chaptersPrefilled }) : t('curriculumMapping.unlinked'),
        'success'
      );
    } catch (e) {
      setRows((prev) => prev.map((r) => (r.subject.id === row.subject.id ? { ...r, saving: false } : r)));
      showToast(getErrorMessage(e), 'error');
    }
  };

  const dropdownOptions = [
    { label: t('curriculumMapping.notNcert'), value: NONE },
    ...options.map((o) => ({ label: o.nameEn, value: o.key })),
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('curriculumMapping.title')} subtitle={t('curriculumMapping.subtitle')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.intro}>{t('curriculumMapping.intro')}</Text>
        {error ? <ErrorNotice message={error} /> : null}
        {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}
        {!loading && rows.length === 0 && !error ? <Text style={styles.empty}>{t('curriculumMapping.empty')}</Text> : null}
        {rows.map((row) => {
          const top = row.suggestions.suggestions[0];
          const current = row.suggestions.current;
          const dirty = (current?.key ?? NONE) !== row.value;
          return (
            <View key={row.subject.id} style={styles.card}>
              <View style={styles.head}>
                <View style={styles.accentBar} />
                <View style={styles.headText}>
                  <Text style={styles.name}>
                    {row.subject.name} ({row.subject.code})
                  </Text>
                  <Text style={styles.meta}>
                    {current
                      ? t('curriculumMapping.current', { name: current.nameEn })
                      : top
                        ? t('curriculumMapping.suggested', { name: top.nameEn })
                        : t('curriculumMapping.noSuggestion')}
                  </Text>
                </View>
              </View>
              <Dropdown
                label={t('curriculumMapping.ncertSubject')}
                value={row.value}
                options={dropdownOptions}
                onSelect={(value) =>
                  setRows((prev) => prev.map((r) => (r.subject.id === row.subject.id ? { ...r, value } : r)))
                }
              />
              <Pressable
                style={[styles.save, (!dirty || row.saving) && styles.disabled]}
                onPress={() => save(row)}
                disabled={!dirty || row.saving}
              >
                <Text style={styles.saveText}>{row.saving ? t('common.saving') : t('common.save')}</Text>
              </Pressable>
            </View>
          );
        })}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  loader: { marginTop: 40 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  accentBar: { width: 4, alignSelf: 'stretch', borderRadius: radius.pill, backgroundColor: accent.base, marginRight: spacing.md },
  headText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  save: {
    alignSelf: 'flex-end',
    backgroundColor: accent.base,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
  },
  saveText: { color: colors.white, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
