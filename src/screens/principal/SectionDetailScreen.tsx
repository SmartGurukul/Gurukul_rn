import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listTeacherAssignments } from '../../api/sectionSubjects';
import type { TeacherSubjectAssignment } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { FEATURE_FLAGS } from '../../config/featureFlags';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { canSeeQuizResults, quizResultsNeedsAssignments } from '../../utils/quizInsights';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SectionDetail'>;

const accent = accents.classes;

export function SectionDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const schoolId = useSchoolId();
  const classSection = route.params.classSection;
  const isAdmin = session.role === 'ADMIN';
  const isStudent = session.ownerType === 'STUDENT';
  // A class teacher has the same report-card authority as admin for their own section (marks entry
  // across every subject, publishing - see AssessmentResultService/ReportCardService on the backend),
  // so the tiles below must be reachable for them too, not just admin.
  const isClassTeacherOfSection = session.role === 'TEACHER' && classSection.classTeacherId === session.ownerId;
  const canManageReportCards = isAdmin || isClassTeacherOfSection;
  // The backend only lets the admin and this section's class teacher read its attendance - other
  // teachers would get a 403 from the attendance screen.
  const canTakeAttendance = isAdmin || isClassTeacherOfSection;

  // Quiz results are open to the admin, the class teacher and the section's subject teachers. Only
  // a teacher who is neither admin nor class teacher needs their assignments to know; if that call
  // fails the tile stays hidden (it is a secondary tile, and the server enforces the rule anyway).
  const needsAssignments = quizResultsNeedsAssignments(session, classSection);
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[] | null>(null);
  useEffect(() => {
    if (!needsAssignments) return;
    let cancelled = false;
    listTeacherAssignments(schoolId, session.ownerId)
      .then((rows) => {
        if (!cancelled) setAssignments(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [needsAssignments, schoolId, session.ownerId]);
  const canSeeQuiz = canSeeQuizResults(session, classSection, assignments);

  // `key` is stable across languages (a route name, or the tile's own name), so it isn't the title.
  const items: { key: string; title: string; description: string; onPress: () => void }[] = [
    // A student's classmates live here rather than as their own dashboard tile, on the student-safe
    // Classmates screen instead of the staff roster.
    isStudent
      ? {
          key: 'classmates',
          title: t('sectionDetail.classmates.title'),
          description: t('sectionDetail.classmates.description'),
          onPress: () => navigation.navigate('Classmates'),
        }
      : {
          key: 'students',
          title: t('sectionDetail.students.title'),
          description: t('sectionDetail.students.description'),
          onPress: () => navigation.navigate('SectionStudentsList', { classSection }),
        },
    {
      key: 'SectionSubjectsList',
      title: isStudent ? t('sectionDetail.subjects.titleStudent') : t('sectionDetail.subjects.title'),
      description: t('sectionDetail.subjects.description'),
      onPress: () => navigation.navigate('SectionSubjectsList', { classSection }),
    },
    // The Resource Hub: NCERT chapters, topics and videos for this section, for every role.
    ...(FEATURE_FLAGS.resourceHub
      ? [
          {
            key: 'Resources',
            title: t('sectionDetail.resources.title'),
            description: isStudent
              ? t('sectionDetail.resources.descriptionStudent')
              : t('sectionDetail.resources.description'),
            onPress: () => navigation.navigate('Resources', { classSection }),
          },
        ]
      : []),
    {
      key: 'SectionAssessmentsList',
      title: t('sectionDetail.assessments.title'),
      description: t('sectionDetail.assessments.description'),
      onPress: () => navigation.navigate('SectionAssessmentsList', { classSection }),
    },
    {
      key: isAdmin ? 'TimetableEditor' : 'MyTimetable',
      title: t('sectionDetail.timetable.title'),
      description: isAdmin ? t('sectionDetail.timetable.descriptionAdmin') : t('sectionDetail.timetable.description'),
      onPress: () =>
        isAdmin
          ? navigation.navigate('TimetableEditor', { classSection })
          : navigation.navigate('MyTimetable', { classSection }),
    },
    ...(canTakeAttendance
      ? [
          {
            key: 'AttendanceTake',
            title: t('sectionDetail.attendance.title'),
            description: t('sectionDetail.attendance.description'),
            onPress: () => navigation.navigate('AttendanceTake', { classSection }),
          },
        ]
      : []),
    ...(canManageReportCards
      ? [
          ...(isClassTeacherOfSection
            ? [
                {
                  key: 'MyClassFees',
                  title: t('sectionDetail.classFees.title'),
                  description: t('sectionDetail.classFees.description'),
                  onPress: () => navigation.navigate('MyClassFees', { classSection }),
                },
              ]
            : []),
          {
            key: 'SectionReportCardsGrid',
            title: t('sectionDetail.marksGrid.title'),
            description: t('sectionDetail.marksGrid.description'),
            onPress: () => navigation.navigate('SectionReportCardsGrid', { classSection }),
          },
          {
            key: 'PublishReportCards',
            title: t('sectionDetail.publish.title'),
            description: t('sectionDetail.publish.description'),
            onPress: () => navigation.navigate('PublishReportCards', { classSection }),
          },
        ]
      : []),
    // Last, so a subject teacher's tile appearing once assignments load doesn't shift the others.
    ...(canSeeQuiz
      ? [
          {
            key: 'QuizResults',
            title: t('sectionDetail.quizResults.title'),
            description: t('sectionDetail.quizResults.description'),
            onPress: () => navigation.navigate('QuizResults', { classSection }),
          },
        ]
      : []),
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle={classSection.academicYear}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {items.map((item) => (
          <Pressable key={item.key} style={styles.row} onPress={item.onPress}>
            <View style={styles.accentBar} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowDescription}>{item.description}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
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
