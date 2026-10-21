import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getConversationMessages, listConversations } from '../../api/chat';
import type { Conversation } from '../../api/types';
import { getLastReadAt } from '../../api/unreadStore';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ConversationsList'>;

// The last list shown, per signed-in owner, so coming back to Messages shows it instantly while a
// fresh copy loads quietly behind it.
let cache: { key: string; conversations: Conversation[]; unreadCounts: Record<string, number> } | null = null;

// Unread counts need each conversation's recent messages; cap how many of those requests run at once
// so a long chat list doesn't flood the server.
const UNREAD_FETCH_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function ConversationsListScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const cacheKey = `${schoolId}:${session.ownerType}:${session.ownerId}`;
  const cached = cache?.key === cacheKey ? cache : null;
  const [conversations, setConversations] = useState<Conversation[]>(cached?.conversations ?? []);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(cached?.unreadCounts ?? {});
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  // Each load gets an id, so a slow earlier load finishing late can't overwrite a newer one.
  const loadId = useRef(0);

  const otherParty = (conversation: Conversation) =>
    conversation.participants.find((p) => p.ownerId !== session.ownerId);

  // Shows the list as soon as the conversations arrive (names come with each one, resolved by the
  // backend), then fills in unread badges without holding the list back.
  const load = async () => {
    const id = ++loadId.current;
    setError(null);
    let withOthers: Conversation[];
    try {
      withOthers = (await listConversations(schoolId)).filter((c) => otherParty(c));
    } catch (e) {
      if (id === loadId.current) {
        setError(getErrorMessage(e));
        setLoading(false);
      }
      return;
    }
    if (id !== loadId.current) return;
    setConversations(withOthers);
    setLoading(false);

    const counts = await mapWithConcurrency(withOthers, UNREAD_FETCH_CONCURRENCY, async (conversation) => {
      try {
        const [history, lastReadAt] = await Promise.all([
          getConversationMessages(schoolId, conversation.id),
          getLastReadAt(conversation.id),
        ]);
        const unread = (history.messages ?? []).filter(
          (m) => m.senderOwnerId !== session.ownerId && (!lastReadAt || m.sentAt > lastReadAt)
        ).length;
        return [conversation.id, unread] as const;
      } catch {
        return [conversation.id, 0] as const; // a badge that fails to load just isn't shown
      }
    });
    if (id !== loadId.current) return;
    const unread = Object.fromEntries(counts);
    setUnreadCounts(unread);
    cache = { key: cacheKey, conversations: withOthers, unreadCounts: unread };
  };

  // 'focus' also fires when the screen first opens, so this is the only load trigger - calling
  // load() here as well used to fetch everything twice on every open.
  useEffect(() => navigation.addListener('focus', load), [schoolId, navigation]);

  const otherPartyName = (conversation: Conversation) => {
    const other = otherParty(conversation);
    if (!other) return 'Conversation';
    return other.name ?? 'Unknown';
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Messages" onBack={() => navigation.goBack()} />
      <ScreenContainer padded={false}>
        <View style={styles.actionsRow}>
          <Pressable style={styles.newButton} onPress={() => navigation.navigate('NewConversation')}>
            <Text style={styles.newButtonText}>+ New Conversation</Text>
          </Pressable>
        </View>
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <ErrorNotice message={error} inset />}
        {!loading && conversations.length === 0 && <Text style={styles.empty}>No conversations yet.</Text>}
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={conversations}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const unread = unreadCounts[item.id] ?? 0;
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  navigation.navigate('ConversationThread', { conversationId: item.id, title: otherPartyName(item) })
                }
              >
                <Text style={styles.rowTitle}>{otherPartyName(item)}</Text>
                {unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  newButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  newButtonText: { color: colors.white, fontWeight: '700' },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, paddingHorizontal: spacing.lg, fontSize: 13 },
  empty: { color: colors.textMuted, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
});
