import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { assignSectionSubject, listSectionSubjects } from '../../api/sectionSubjects';
import { getEmployee } from '../../api/employees';
import type { Employee, Subject, SubjectAssignment } from '../../api/types';
import EmployeePicker from '../../components/EmployeePicker';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import SubjectPicker from '../../components/SubjectPicker';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { assessmentPermissions } from '../../utils/assessmentPermissions';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SectionSubjectsList'>;

export function SectionSubjectsListScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const classSection = route.params.classSection;
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([]);
  // The server lets only an admin or this section's class teacher assign subject teachers.
  const canAssign = assessmentPermissions(session, classSection, assignments).canAssignSubjectTeachers;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [subjectLabel, setSubjectLabel] = useState('');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherLabel, setTeacherLabel] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [openingTeacherId, setOpeningTeacherId] = useState<string | null>(null);

  const handleOpenTeacher = async (teacherId: string) => {
    setOpeningTeacherId(teacherId);
    setError(null);
    try {
      const employee = await getEmployee(schoolId, teacherId);
      navigation.navigate('EmployeeDetail', { employee });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setOpeningTeacherId(null);
    }
  };

  const load = useCallback(() => {
    setError(null);
    return listSectionSubjects(schoolId, classSection.id)
      .then(setAssignments)
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId, classSection.id]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  const handleAssign = async () => {
    if (!subjectId || !teacherId) return;
    setAssigning(true);
    setError(null);
    try {
      const created = await assignSectionSubject(schoolId, classSection.id, { subjectId, teacherId });
      setAssignments((prev) => [...prev.filter((a) => a.subjectId !== created.subjectId), created]);
      setShowAssign(false);
      setSubjectId(null);
      setSubjectLabel('');
      setTeacherId(null);
      setTeacherLabel('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setAssigning(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle="Subjects"
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {canAssign && (showAssign ? (
          <View style={styles.assignForm}>
            <Text style={styles.label}>Subject</Text>
            <SubjectPicker
              schoolId={schoolId}
              selectedId={subjectId}
              onSelect={(s: Subject) => {
                setSubjectId(s.id);
                setSubjectLabel(`${s.name} (${s.code})`);
              }}
            />
            {subjectLabel ? <Text style={styles.selectedHint}>Subject: {subjectLabel}</Text> : null}

            <Text style={[styles.label, { marginTop: spacing.md }]}>Teacher</Text>
            <EmployeePicker
              schoolId={schoolId}
              selectedId={teacherId}
              onSelect={(e: Employee) => {
                setTeacherId(e.id);
                setTeacherLabel(`${e.name} (${e.designation})`);
              }}
            />
            {teacherLabel ? <Text style={styles.selectedHint}>Teacher: {teacherLabel}</Text> : null}

            <Pressable
              style={[styles.addButton, (!subjectId || !teacherId || assigning) && styles.disabled]}
              onPress={handleAssign}
              disabled={!subjectId || !teacherId || assigning}
            >
              <Text style={styles.addButtonText}>{assigning ? 'Assigning…' : 'Assign subject'}</Text>
            </Pressable>
            <Pressable onPress={() => setShowAssign(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addButton} onPress={() => setShowAssign(true)}>
            <Text style={styles.addButtonText}>+ Assign subject</Text>
          </Pressable>
        ))}

        {error && <ErrorNotice message={error} />}

        <FlatList
          keyboardShouldPersistTaps="handled"
          data={assignments}
          scrollEnabled={false}
          keyExtractor={(item) => item.subjectId}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>No subjects assigned to this section yet.</Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => handleOpenTeacher(item.teacherId)}
              disabled={openingTeacherId !== null}
            >
              <View>
                <Text style={styles.rowName}>
                  {item.subjectName} ({item.subjectCode})
                </Text>
                <Text style={styles.rowMeta}>Teacher: {item.teacherName}</Text>
              </View>
            </Pressable>
          )}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  selectedHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  assignForm: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  addButtonText: { color: colors.white, fontWeight: '700' },
  cancel: { color: colors.textMuted, textAlign: 'center' },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  loader: { marginTop: 40 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
