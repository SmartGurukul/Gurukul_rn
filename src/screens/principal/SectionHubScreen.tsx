import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { accents, colors, radius, softShadow, spacing, type AccentKey } from '../../theme/colors';
import type { HubSection, PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SectionHub'>;

interface HubItem {
  key: string;
  accentKey: AccentKey;
  icon: string;
  /** i18n key prefix holding `title` and `description`. */
  copyKey: string;
  navigate: (navigation: Props['navigation']) => void;
}

// Some admin dashboard tiles open a section rather than one screen; this screen lists the screens
// grouped under it. Items reuse the dashboard's feature copy where a screen used to be
// its own tile, so the wording a principal already knows stays the same.
const SECTIONS: Record<HubSection, HubItem[]> = {
  students: [
    { key: 'students', accentKey: 'students', icon: 'user-graduate', copyKey: 'dashboard.features.students', navigate: (n) => n.navigate('StudentsList') },
    { key: 'registrationInbox', accentKey: 'registrationInbox', icon: 'user-check', copyKey: 'dashboard.features.registrationInbox', navigate: (n) => n.navigate('RegistrationInbox') },
    { key: 'idCards', accentKey: 'idCards', icon: 'id-badge', copyKey: 'dashboard.features.idCards', navigate: (n) => n.navigate('IdCardSheets') },
  ],
  attendance: [
    { key: 'staffAttendance', accentKey: 'staffAttendance', icon: 'clipboard-check', copyKey: 'dashboard.features.staffAttendance', navigate: (n) => n.navigate('StaffAttendance') },
    { key: 'attendanceDevices', accentKey: 'attendanceDevices', icon: 'id-card', copyKey: 'dashboard.features.attendanceDevices', navigate: (n) => n.navigate('AttendanceDevices') },
    { key: 'schoolLocation', accentKey: 'schoolLocation', icon: 'map-marked-alt', copyKey: 'dashboard.features.schoolLocation', navigate: (n) => n.navigate('SchoolLocationSettings') },
  ],
  vendorsExpenses: [
    { key: 'vendors', accentKey: 'vendors', icon: 'truck', copyKey: 'dashboard.features.vendors', navigate: (n) => n.navigate('VendorsList') },
    { key: 'infraExpenses', accentKey: 'infraExpenses', icon: 'tools', copyKey: 'dashboard.features.infraExpenses', navigate: (n) => n.navigate('InfraExpensesList') },
  ],
  academics: [
    { key: 'classes', accentKey: 'classes', icon: 'chalkboard-teacher', copyKey: 'dashboard.features.classes', navigate: (n) => n.navigate('ClassesList') },
    { key: 'timetableEditor', accentKey: 'timetableEditor', icon: 'table', copyKey: 'dashboard.features.timetableEditor', navigate: (n) => n.navigate('TimetableEditor') },
    { key: 'substitutions', accentKey: 'substitutions', icon: 'user-clock', copyKey: 'dashboard.features.substitutions', navigate: (n) => n.navigate('Substitutions') },
    { key: 'bellSchedule', accentKey: 'bellSchedule', icon: 'bell', copyKey: 'dashboard.features.bellSchedule', navigate: (n) => n.navigate('PeriodSetup') },
    { key: 'rooms', accentKey: 'rooms', icon: 'door-open', copyKey: 'dashboard.features.rooms', navigate: (n) => n.navigate('Rooms') },
    { key: 'gradingScale', accentKey: 'gradingScale', icon: 'sliders-h', copyKey: 'dashboard.features.gradingScale', navigate: (n) => n.navigate('GradingScale') },
    { key: 'academicTerms', accentKey: 'gradingScale', icon: 'calendar-alt', copyKey: 'dashboard.features.academicTerms', navigate: (n) => n.navigate('AcademicTerms') },
    { key: 'schoolBoard', accentKey: 'gradingScale', icon: 'book', copyKey: 'dashboard.features.schoolBoard', navigate: (n) => n.navigate('SchoolBoardSettings') },
    { key: 'holidays', accentKey: 'holidays', icon: 'calendar-day', copyKey: 'dashboard.features.holidays', navigate: (n) => n.navigate('Holidays') },
    { key: 'teacherTools', accentKey: 'teacherTools', icon: 'chalkboard-teacher', copyKey: 'dashboard.features.teacherTools', navigate: (n) => n.navigate('TeacherToolsHub') },
  ],
  reports: [
    { key: 'attendanceExport', accentKey: 'attendanceExport', icon: 'file-excel', copyKey: 'dashboard.features.attendanceExport', navigate: (n) => n.navigate('AttendanceExport') },
    { key: 'activityLog', accentKey: 'activityLog', icon: 'history', copyKey: 'dashboard.features.activityLog', navigate: (n) => n.navigate('ActivityLog') },
    { key: 'aiMisuseLog', accentKey: 'aiMisuseLog', icon: 'user-shield', copyKey: 'dashboard.features.aiMisuseLog', navigate: (n) => n.navigate('AiMisuseLog') },
  ],
};

export function SectionHubScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { section } = route.params;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t(`sectionHub.${section}.title`)}
        subtitle={t(`sectionHub.${section}.subtitle`)}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {SECTIONS[section].map((item) => {
          const accent = accents[item.accentKey];
          return (
            <Pressable
              key={item.key}
              style={styles.row}
              onPress={() => item.navigate(navigation)}
              accessibilityRole="button"
            >
              <View style={[styles.iconCircle, { backgroundColor: accent.light }]}>
                <FontAwesome5 name={item.icon} size={18} color={accent.base} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t(`${item.copyKey}.title`)}</Text>
                <Text style={styles.rowDescription}>{t(`${item.copyKey}.description`)}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowDescription: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  chevron: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
});
