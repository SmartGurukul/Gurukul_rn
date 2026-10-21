import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { startImmediateCall } from '../../api/calls';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { useSchoolId } from '../../context/SchoolContext';
import { useCallTargets, type CallTarget } from '../../hooks/useCallTargets';
import { useGoogleMeetGate } from '../../hooks/useGoogleMeetGate';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PickCallTarget'>;

export function PickCallTargetScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const {
    targets,
    filteredTargets,
    localQuery,
    setLocalQuery,
    loading,
    error,
    canSearchStudents,
    studentQuery,
    setStudentQuery,
    studentResults,
    searchingStudents,
  } = useCallTargets();
  const [callingId, setCallingId] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const confirmBeforeCall = useGoogleMeetGate(schoolId, navigation);

  const handleCall = (target: CallTarget) => {
    setCallingId(target.ownerId);
    setCallError(null);
    confirmBeforeCall(
      async () => {
        try {
          const session = await startImmediateCall(schoolId, {
            calleeOwnerType: target.ownerType,
            calleeOwnerId: target.ownerId,
          });
          navigation.replace('InCall', {
            roomName: session.roomName,
            provider: session.provider,
            displayName: target.name,
            callLogId: session.callLogId,
          });
        } catch (e) {
          setCallError(getErrorMessage(e));
        } finally {
          setCallingId(null);
        }
      },
      () => setCallingId(null)
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Start a call" onBack={() => navigation.goBack()} />
      <ScreenContainer padded={false}>
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {(error || callError) && <ErrorNotice message={error || callError || ''} />}

        {canSearchStudents && (
          <View style={styles.searchSection}>
            <SearchBar value={studentQuery} onChangeText={setStudentQuery} placeholder="Search the student directory…" />
            {searchingStudents && <ActivityIndicator color={colors.primary} style={styles.searchLoading} />}
            {!searchingStudents && studentQuery.trim().length >= 2 && studentResults.length === 0 && (
              <Text style={styles.empty}>No students of yours match that search.</Text>
            )}
          </View>
        )}
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={studentResults}
          scrollEnabled={false}
          keyExtractor={(item) => `${item.ownerType}:${item.ownerId}`}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => handleCall(item)}
              disabled={callingId === item.ownerId}
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
              {callingId === item.ownerId ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.callLabel}>Call</Text>
              )}
            </Pressable>
          )}
        />

        {!loading && targets.length > 0 && (
          <View style={styles.searchSection}>
            <SearchBar value={localQuery} onChangeText={setLocalQuery} placeholder="Search by name…" />
          </View>
        )}
        {!loading && filteredTargets.length === 0 && !error && studentResults.length === 0 && (
          <Text style={styles.empty}>
            {localQuery ? 'No match found.' : 'No one available to call right now.'}
          </Text>
        )}
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filteredTargets}
          scrollEnabled={false}
          keyExtractor={(item) => `${item.ownerType}:${item.ownerId}`}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => handleCall(item)}
              disabled={callingId === item.ownerId}
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
              {callingId === item.ownerId ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.callLabel}>Call</Text>
              )}
            </Pressable>
          )}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, padding: spacing.lg, fontSize: 13 },
  empty: { color: colors.textMuted, padding: spacing.lg },
  searchSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchLoading: { marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  callLabel: { color: colors.primary, fontWeight: '700' },
});
