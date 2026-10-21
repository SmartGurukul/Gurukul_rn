import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { downloadAttendanceExport, XLSX_MIME_TYPE } from '../../api/attendanceExport';
import type { AttendanceExportType } from '../../api/attendanceExport';
import { listClassSections } from '../../api/classSections';
import type { ClassSection } from '../../api/types';
import { DatePickerField, toIsoDate } from '../../components/DatePickerField';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { MAX_EXPORT_RANGE_DAYS, validateExportRange } from '../../utils/attendanceExportRange';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AttendanceExport'>;

const accent = accents.attendanceExport;

function firstOfMonth(): string {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function AttendanceExportScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();

  const [type, setType] = useState<AttendanceExportType>('STUDENT');
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [sectionId, setSectionId] = useState<string | undefined>(undefined);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(toIsoDate(new Date()));
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listClassSections(schoolId)
      .then(setSections)
      .catch(() => setSections([]));
  }, [schoolId]);

  const handleExport = async () => {
    const error = validateExportRange(from, to);
    if (error) {
      showToast(t(error, { days: MAX_EXPORT_RANGE_DAYS }), 'error');
      return;
    }
    setExporting(true);
    try {
      const file = await downloadAttendanceExport(schoolId, {
        type,
        from,
        to,
        sectionId: type === 'STUDENT' ? sectionId : undefined,
      });
      if (!(await Sharing.isAvailableAsync())) {
        showToast(t('attendanceExport.savedTo', { path: file.uri }), 'success');
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: XLSX_MIME_TYPE,
        UTI: 'org.openxmlformats.spreadsheetml.sheet',
        dialogTitle: t('attendanceExport.shareTitle'),
      });
    } catch (e) {
      showToast(t('attendanceExport.errors.failed', { message: getErrorMessage(e) }), 'error');
    } finally {
      setExporting(false);
    }
  };

  const chip = (selected: boolean) => [styles.chip, selected && { backgroundColor: accent.base }];
  const chipText = (selected: boolean) => [styles.chipText, selected && styles.chipTextActive];

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('attendanceExport.title')} onBack={() => navigation.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <Text style={styles.intro}>{t('attendanceExport.intro')}</Text>

        <Text style={styles.fieldLabel}>{t('attendanceExport.whose')}</Text>
        <View style={styles.chipRow}>
          {(['STUDENT', 'STAFF'] as AttendanceExportType[]).map((option) => (
            <Pressable key={option} style={chip(type === option)} onPress={() => setType(option)}>
              <Text style={chipText(type === option)}>{t(`attendanceExport.type.${option}`)}</Text>
            </Pressable>
          ))}
        </View>

        {type === 'STUDENT' ? (
          <>
            <Text style={styles.fieldLabel}>{t('attendanceExport.classSection')}</Text>
            <View style={styles.chipRow}>
              <Pressable style={chip(!sectionId)} onPress={() => setSectionId(undefined)}>
                <Text style={chipText(!sectionId)}>{t('attendanceExport.allSections')}</Text>
              </Pressable>
              {sections.map((section) => (
                <Pressable
                  key={section.id}
                  style={chip(sectionId === section.id)}
                  onPress={() => setSectionId(section.id)}
                >
                  <Text style={chipText(sectionId === section.id)}>{section.displayLabel}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <DatePickerField label={t('attendanceExport.from')} value={from} onChange={setFrom} maximumDate={new Date()} />
        <DatePickerField label={t('attendanceExport.to')} value={to} onChange={setTo} maximumDate={new Date()} />

        <Text style={styles.note}>{t('attendanceExport.columnsNote')}</Text>

        <Pressable style={styles.exportButton} onPress={handleExport} disabled={exporting} accessibilityRole="button">
          {exporting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.exportButtonText}>{t('attendanceExport.exportButton')}</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  intro: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.sm },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  note: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md },
  exportButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  exportButtonText: { color: colors.white, fontWeight: '700' },
});
