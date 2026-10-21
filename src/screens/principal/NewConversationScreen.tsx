import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createConversation, listChatContacts } from '../../api/chat';
import { isActiveEmployee, listAllEmployees } from '../../api/employees';
import { listAllStudents } from '../../api/students';
import type { ChatContact, OwnerType, Student } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'NewConversation'>;

interface Party {
  ownerType: OwnerType;
  ownerId: string;
  name: string;
}

/** "Mrs Rao - Class teacher 5 - A, Maths (5 - A)" - why this person is someone the parent can message. */
function staffLabel(contact: ChatContact, t: TFunction) {
  const reasons = [
    ...contact.classTeacherOf.map((section) => t('newConversation.classTeacherOf', { section })),
    ...contact.subjects,
    ...(contact.admin ? [t('newConversation.admin')] : []),
  ];
  return reasons.length ? `${contact.name} - ${reasons.join(', ')}` : contact.name;
}

export function NewConversationScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const isStudent = session.role === 'STUDENT';
  const isParent = session.role === 'PARENT';
  const isStaff = session.role === 'TEACHER' || session.role === 'ADMIN';
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    if (isParent) {
      // A parent may only message their children's teachers and the school's admins - the backend
      // decides who that is (and enforces it again when the conversation is created).
      listChatContacts(schoolId)
        .then((contacts) => setParties(contacts.map((c) => ({ ownerType: c.ownerType, ownerId: c.ownerId, name: staffLabel(c, t) }))))
        .catch((e) => setError(getErrorMessage(e)))
        .finally(() => setLoading(false));
      return;
    }
    Promise.all([
      listAllEmployees(schoolId),
      // Students can only message staff - student-to-student chat isn't allowed (the backend
      // rejects it) - so they get no student list, and don't download the roster at all.
      isStudent ? Promise.resolve([] as Student[]) : listAllStudents(schoolId),
      isStaff ? listChatContacts(schoolId).catch(() => [] as ChatContact[]) : Promise.resolve([] as ChatContact[]),
    ])
      .then(([employees, visibleStudents, parentContacts]) => {
        const list: Party[] = [
          ...employees
            .filter((e) => e.id !== session.ownerId && isActiveEmployee(e))
            .map((e) => ({ ownerType: 'EMPLOYEE' as const, ownerId: e.id, name: `${e.name} (Staff)` })),
          ...visibleStudents.map((s) => ({ ownerType: 'STUDENT' as const, ownerId: s.id, name: `${s.name} (Student)` })),
          // Staff: parents of their own students (an admin: every parent).
          ...parentContacts.map((c) => ({
            ownerType: 'PARENT' as const,
            ownerId: c.ownerId,
            name: t('newConversation.parentOf', { name: c.name, children: c.children.join(', ') }),
          })),
        ];
        setParties(list);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, session.ownerId, isStudent, isParent, isStaff, t]);

  const visibleParties = parties.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  const handleSelect = async (party: Party) => {
    setCreatingId(party.ownerId);
    setError(null);
    try {
      const conversation = await createConversation(schoolId, {
        otherPartyOwnerType: party.ownerType,
        otherPartyOwnerId: party.ownerId,
      });
      navigation.replace('ConversationThread', { conversationId: conversation.id, title: party.name });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="New Conversation" onBack={() => navigation.goBack()} />
      <ScreenContainer padded={false}>
        <View style={styles.searchWrap}>
          <SearchBar value={query} onChangeText={setQuery} placeholder={isParent ? t('newConversation.searchTeachers') : 'Search staff or classmates by name'} />
        </View>
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <ErrorNotice message={error} inset />}
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={visibleParties}
          scrollEnabled={false}
          keyExtractor={(item) => `${item.ownerType}:${item.ownerId}`}
          ListEmptyComponent={
            !loading && !error ? <Text style={styles.empty}>{query ? 'No match found.' : 'No one to message yet.'}</Text> : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => handleSelect(item)} disabled={creatingId === item.ownerId}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              {creatingId === item.ownerId && <ActivityIndicator color={colors.primary} />}
            </Pressable>
          )}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, padding: spacing.lg, fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
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
});
