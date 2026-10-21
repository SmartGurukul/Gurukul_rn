import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createClassSection, listClassSections } from '../../api/classSections';
import { getErrorMessage } from '../../api/errorMessage';
import { getSchool } from '../../api/schools';
import { bulkCreateStudents } from '../../api/students';
import type { ClassSection, StudentBulkImportResponse } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { currentAcademicYear } from '../../utils/classSetup';
import { missingClassSections, parseRoster, toStudentRequests, type RosterRow } from '../../utils/rosterImport';
import { todayIso } from '../../utils/timetable';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'StudentImport'>;

const MAX_ROWS = 2000;

/**
 * Imports the student register the school already has: paste it from Excel or WhatsApp, or pick
 * a .csv file. The parser (utils/rosterImport) shows every row with what is wrong with it before
 * anything is sent; the clean rows go up in one bulk call and the server's per-row answer is shown
 * back, so the school knows exactly which lines still need a hand.
 */
export function StudentImportScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [sections, setSections] = useState<ClassSection[] | null>(null);
  const [city, setCity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creatingSections, setCreatingSections] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ response: StudentBulkImportResponse; lines: number[] } | null>(null);

  const load = useCallback(() => {
    Promise.all([listClassSections(schoolId), getSchool(schoolId)])
      .then(([cs, school]) => {
        setSections(cs);
        setCity(school.city);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId]);
  useEffect(load, [load]);

  const parsed = useMemo(() => (text.trim() ? parseRoster(text) : null), [text]);
  const prepared = useMemo(
    () => (parsed ? toStudentRequests(parsed.rows, sections ?? [], { address: city, admissionDate: todayIso() }) : null),
    [parsed, sections, city]
  );
  const missing = useMemo(() => (parsed ? missingClassSections(parsed.rows, sections ?? []) : []), [parsed, sections]);
  const badRows = prepared ? prepared.rows.filter((r) => r.problems.length > 0) : [];
  const tooMany = (parsed?.rows.length ?? 0) > MAX_ROWS;

  const pickFile = async () => {
    setError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'text/tab-separated-values'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const content = await new File(picked.assets[0].uri).text();
      setText(content);
      setResult(null);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const createMissing = async () => {
    setCreatingSections(true);
    const academicYear = currentAcademicYear();
    try {
      for (const m of missing) {
        await createClassSection(schoolId, { className: m.className, section: m.section, academicYear });
      }
      showToast(t('studentImport.sectionsCreated', { count: missing.length }), 'success');
      load();
    } catch (e) {
      setError(getErrorMessage(e));
      load();
    } finally {
      setCreatingSections(false);
    }
  };

  const runImport = async () => {
    if (!prepared || prepared.requests.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const response = await bulkCreateStudents(schoolId, prepared.requests);
      setResult({ response, lines: prepared.requestLines });
      showToast(t('studentImport.imported', { count: response.succeeded }), 'success');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setImporting(false);
    }
  };

  const problemText = (row: RosterRow) => row.problems.map((p) => t(`studentImport.problems.${p}`)).join(', ');

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('studentImport.title')} subtitle={t('studentImport.subtitle')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {error && <ErrorNotice message={error} />}
        <Text style={styles.intro}>{t('studentImport.intro')}</Text>
        <View style={styles.formatCard}>
          <Text style={styles.formatTitle}>{t('studentImport.format.title')}</Text>
          <Text style={styles.formatColumns}>{t('studentImport.format.columns')}</Text>
          <Text style={styles.formatHint}>{t('studentImport.format.hint')}</Text>
        </View>

        <TextInput
          style={styles.input}
          multiline
          value={text}
          onChangeText={(v) => {
            setText(v);
            setResult(null);
          }}
          placeholder={t('studentImport.placeholder')}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
          accessibilityLabel={t('studentImport.title')}
        />
        <Pressable style={styles.secondary} onPress={pickFile} accessibilityRole="button">
          <Text style={styles.secondaryText}>{t('studentImport.pickFile')}</Text>
        </Pressable>

        {sections === null && <ActivityIndicator color={colors.primary} style={styles.spinner} />}

        {parsed && prepared && (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>
              {t('studentImport.preview', { rows: parsed.rows.length, ready: prepared.requests.length, problems: badRows.length })}
            </Text>
            {!parsed.hadHeader && <Text style={styles.previewHint}>{t('studentImport.noHeader')}</Text>}
            {tooMany && <Text style={styles.previewProblem}>{t('studentImport.tooMany', { max: MAX_ROWS })}</Text>}

            {missing.length > 0 && (
              <View style={styles.missingBox}>
                <Text style={styles.missingText}>
                  {t('studentImport.missingSections', { count: missing.length, list: missing.map((m) => `${m.className}-${m.section}`).join(', ') })}
                </Text>
                <Pressable style={[styles.secondary, styles.missingButton]} onPress={createMissing} disabled={creatingSections} accessibilityRole="button">
                  <Text style={styles.secondaryText}>{creatingSections ? t('studentImport.creatingSections') : t('studentImport.createSections')}</Text>
                </Pressable>
              </View>
            )}

            {badRows.length > 0 && (
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.problemList} nestedScrollEnabled>
                {badRows.slice(0, 50).map((row) => (
                  <Text key={row.line} style={styles.previewProblem}>
                    {t('studentImport.lineProblem', { line: row.line, name: row.name || '—', problems: problemText(row) })}
                  </Text>
                ))}
                {badRows.length > 50 && <Text style={styles.previewHint}>{t('studentImport.moreProblems', { count: badRows.length - 50 })}</Text>}
              </ScrollView>
            )}
          </View>
        )}

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{t('studentImport.result', { succeeded: result.response.succeeded, failed: result.response.failed })}</Text>
            {result.response.results
              .filter((r) => !r.success)
              .slice(0, 50)
              .map((r) => (
                <Text key={r.index} style={styles.previewProblem}>
                  {t('studentImport.lineProblem', { line: result.lines[r.index] ?? r.index + 1, name: r.name || '—', problems: r.error ?? '' })}
                </Text>
              ))}
          </View>
        )}

        <Pressable
          style={[styles.submit, (!prepared || prepared.requests.length === 0 || importing || tooMany || !!result) && styles.submitDisabled]}
          onPress={runImport}
          disabled={!prepared || prepared.requests.length === 0 || importing || tooMany || !!result}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>
            {importing ? t('studentImport.importing') : t('studentImport.import', { count: prepared?.requests.length ?? 0 })}
          </Text>
        </Pressable>
        {result && (
          <Pressable style={styles.secondary} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.secondaryText}>{t('studentImport.done')}</Text>
          </Pressable>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  intro: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
  formatCard: { backgroundColor: accents.students.light, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  formatTitle: { fontSize: 12, fontWeight: '700', color: accents.students.base, textTransform: 'uppercase', letterSpacing: 0.4 },
  formatColumns: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.xs },
  formatHint: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  input: {
    minHeight: 160,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  secondary: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  secondaryText: { color: colors.primary, fontWeight: '700' },
  spinner: { marginVertical: spacing.md },
  preview: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  previewTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  previewHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  previewProblem: { fontSize: 12, color: colors.error, marginTop: spacing.xs },
  problemList: { maxHeight: 220, marginTop: spacing.sm },
  missingBox: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: accents.classes.light },
  missingText: { fontSize: 13, color: colors.textPrimary, marginBottom: spacing.sm },
  missingButton: { marginBottom: 0, backgroundColor: colors.surface },
  resultCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.success },
  resultTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  submit: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.md, ...softShadow },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
