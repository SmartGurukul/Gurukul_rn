import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useComposerBottomPadding } from '../../hooks/useComposerBottomPadding';
import {
  cancelBotAction,
  confirmBotAction,
  getBotAction,
  getConversationMessages,
  presignChatAttachment,
} from '../../api/chat';
import { onReconnect, sendMessage, subscribeToConversation, subscribeToConversationUpdates } from '../../api/chatSocket';
import { ApiError } from '../../api/client';
import type { BotAction, Message } from '../../api/types';
import { markConversationRead } from '../../api/unreadStore';
import { AiMyRecordsSheet } from '../../components/AiMyRecordsSheet';
import { AiNoticeBar } from '../../components/AiNoticeBar';
import { AiPausedBanner } from '../../components/AiPausedBanner';
import { BotActionCard } from '../../components/BotActionCard';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { useToast } from '../../context/ToastContext';
import { useAiStatus } from '../../hooks/useAiStatus';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage, isRetryable } from '../../api/errorMessage';
import { pickedFileSize, putToPresignedUrl } from '../../api/presignedUpload';
import { ErrorNotice } from '../../components/ErrorNotice';
import { messageSaysOff, pausedUntilFromMessage } from '../../utils/aiGuard';
import { confirmAlertBody, isBotAction, notPendingMessage } from '../../utils/botActions';
import {
  BOT_TYPING_TIMEOUT_MS,
  NOT_TYPING,
  applyActionUpdate,
  mergeHistoryPage,
  newMessages,
  onIncoming,
  onTypingTimeout,
  startTyping,
  supportsBotActions,
  upsertMessage,
  visibleContent,
  type TypingState,
} from '../../utils/chatMessages';
import { singleFlightWithTrailing } from '../../utils/singleFlight';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ConversationThread'>;

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Which state of a card a receive time belongs to (a new state comes with a new serverTime). */
function actionClockKey(action: BotAction): string {
  return `${action.id}@${action.serverTime}`;
}

function withoutKey(map: Record<string, string>, key: string): Record<string, string> {
  if (!(key in map)) return map;
  const next = { ...map };
  delete next[key];
  return next;
}

export function ConversationThreadScreen({ route, navigation }: Props) {
  const { conversationId, title, isBot = false } = route.params;
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  // On Android the window normally shrinks for the keyboard; this covers builds where it does not.
  const androidKeyboardInset = useKeyboardInset(Platform.OS === 'android');
  const { session } = useAuth();
  const { showToast } = useToast();
  const composerBottomPadding = useComposerBottomPadding();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  // The list as last committed, so a frame arriving before React re-renders still merges into the
  // newest list (and "is this message new?" is answered against it).
  const messagesRef = useRef<Message[]>([]);
  // When each state of a card reached the phone, for its countdown (see actionClockKey).
  const [receivedAt, setReceivedAt] = useState<Record<string, number>>({});
  // Whether the server sends bot actions (it wrote the `action` key on a message we've seen).
  const [actionsSupported, setActionsSupported] = useState(false);
  const [typing, setTyping] = useState<TypingState>(NOT_TYPING);
  const [busyAction, setBusyAction] = useState<{ id: string; kind: 'confirm' | 'cancel' } | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const decidingRef = useRef(false);
  const confirmAlertOpenRef = useRef(false);
  // The updates subscription was dropped by a STOMP ERROR, so its next subscribe is a recovery.
  const updatesDroppedRef = useRef(false);
  // The helpdesk bot answers school work only: after repeated refusals the user's AI help is
  // paused for a while (the composer locks until then), and the bot can be switched off. Human
  // chats make no AI status requests.
  const { pausedUntil, botEnabled, enterPaused, refresh: refreshAiStatus } = useAiStatus(schoolId, isBot);
  const aiPaused = isBot && pausedUntil !== null;
  const [recordsOpen, setRecordsOpen] = useState(false);

  const commit = useCallback((next: Message[]) => {
    if (next === messagesRef.current) return;
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const noteActions = useCallback((actions: BotAction[]) => {
    if (actions.length === 0) return;
    const now = Date.now();
    setReceivedAt((prev) => {
      let next = prev;
      for (const action of actions) {
        const key = actionClockKey(action);
        if (key in next) continue;
        if (next === prev) next = { ...prev };
        next[key] = now;
      }
      return next;
    });
  }, []);

  /**
   * Merges messages from any source (history, a frame, a refetch) by id. `countsForTyping`: a bot
   * message new to the list ends "typing…" (not for the first history load, whose bot messages are
   * old replies).
   */
  const ingest = useCallback(
    (incoming: Message[], countsForTyping = true) => {
      if (incoming.length === 0) return;
      const prev = messagesRef.current;
      const fresh = newMessages(prev, incoming);
      commit(mergeHistoryPage(prev, incoming));
      noteActions(incoming.flatMap((m) => (m.action ? [m.action] : [])));
      if (incoming.some(supportsBotActions)) setActionsSupported(true);
      if (countsForTyping && fresh.length > 0) setTyping((state) => fresh.reduce(onIncoming, state));
    },
    [commit, noteActions]
  );

  /** A card's new state from a confirm or cancel answer (or a refresh), unless a newer one is shown. */
  const applyAction = useCallback(
    (action: BotAction) => {
      commit(applyActionUpdate(messagesRef.current, action));
      noteActions([action]);
    },
    [commit, noteActions]
  );

  /**
   * Fetches the newest history page again and merges it in: whatever arrived while the socket was
   * down (a bot reply, a card's new state, a follow-up) then still shows. One request at a time,
   * but a call during one (the reconnect a few seconds after the resume refetch started) runs
   * another when it ends, so it is never just dropped. Best effort - the next reconnect or return
   * to the app tries again.
   */
  const [refetchFlight] = useState(singleFlightWithTrailing);
  const refetchLatest = useCallback(() => {
    refetchFlight(() =>
      getConversationMessages(schoolId, conversationId).then((history) => ingest(history.messages ?? []))
    );
  }, [refetchFlight, schoolId, conversationId, ingest]);

  /**
   * Catches up on frames that may have been missed (a reconnect, "typing…" giving up, the updates
   * subscription coming back): the newest messages, and in the helpdesk chat the AI status too. A
   * reply that paused the user, or says the bot is off, carries that only on its live frame - REST
   * history has no aiNotice - so without this the composer would stay open under a "paused" bubble.
   * (Returning to the app already reads the status in useAiStatus.)
   */
  const catchUp = useCallback(() => {
    refetchLatest();
    if (isBot) refreshAiStatus();
  }, [refetchLatest, isBot, refreshAiStatus]);

  useEffect(() => {
    let cancelled = false;

    getConversationMessages(schoolId, conversationId)
      .then((history) => {
        if (!cancelled) ingest(history.messages ?? [], false);
      })
      .catch((e) => {
        if (!cancelled) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Kept even when the socket's first connect fails: stompjs retries, and the connect that works
    // subscribes it and refetches (onReconnect below).
    const unsubscribe = subscribeToConversation(
      schoolId,
      conversationId,
      (message) => {
        if (cancelled) return;
        ingest([message]);
        // The bot's refusal that starts a pause (and its reply to a paused user) says until when.
        // Only live frames carry it; REST history never does.
        if (isBot) enterPaused(pausedUntilFromMessage(message));
        // "Turned off" since this chat opened (that takes a server restart): read the status again
        // so the "off" banner shows.
        if (isBot && messageSaysOff(message)) refreshAiStatus();
      },
      {
        onError: (e) => {
          if (!cancelled) setError(getErrorMessage(e));
        },
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [schoolId, conversationId, ingest, isBot, enterPaused, refreshAiStatus]);

  // Card updates (saved, cancelled, expired, replaced) come on their own destination, which only a
  // server with bot actions has - an older one would refuse it and end the socket - so it's
  // subscribed only in the helpdesk chat, once a message shows the server knows bot actions.
  // Without live updates a card still catches up on the next refetch.
  useEffect(() => {
    if (!isBot || !actionsSupported) return;
    let cancelled = false;
    const unsubscribe = subscribeToConversationUpdates(
      schoolId,
      conversationId,
      (frame) => {
        if (cancelled) return;
        commit(upsertMessage(messagesRef.current, frame.message));
        if (frame.message.action) noteActions([frame.message.action]);
      },
      {
        // A STOMP ERROR dropped it - the server may have been rolled back to a build that refuses
        // it. Check again as on the first load: the refetch after the reconnect subscribes it again
        // only if its messages still have the `action` key.
        onDropped: () => {
          if (cancelled) return;
          updatesDroppedRef.current = true;
          setActionsSupported(false);
        },
      }
    );
    if (updatesDroppedRef.current) {
      // Back after a drop: fetch what changed while it wasn't subscribed.
      updatesDroppedRef.current = false;
      catchUp();
    }
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isBot, actionsSupported, schoolId, conversationId, commit, noteActions, catchUp]);

  // After the socket reconnects, or the app comes back to the foreground, frames sent meanwhile are
  // lost: fetch the newest page again (and, after a reconnect, the AI status - useAiStatus reads it
  // itself on returning to the app).
  useEffect(() => {
    const offReconnect = onReconnect(catchUp);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refetchLatest();
    });
    return () => {
      offReconnect();
      appStateSubscription.remove();
    };
  }, [catchUp, refetchLatest]);

  // "typing…" gives up after 90 s; the reply may still have been sent while the socket was down,
  // so look for it then.
  useEffect(() => {
    if (typing.since === null) return;
    const armedSince = typing.since;
    const left = BOT_TYPING_TIMEOUT_MS - (Date.now() - armedSince);
    const timer = setTimeout(
      () => {
        // Ends it without reading the clock again (see onTypingTimeout); a newer send re-arms.
        setTyping((current) => onTypingTimeout(current, armedSince));
        catchUp();
      },
      Math.max(0, left)
    );
    return () => clearTimeout(timer);
  }, [typing, catchUp]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last) markConversationRead(conversationId, last.sentAt);
  }, [messages, conversationId]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending || aiPaused) return;
    setDraft('');
    setSending(true);
    if (isBot) setTyping(startTyping(Date.now()));
    try {
      await sendMessage(schoolId, conversationId, content);
    } catch (e) {
      if (isBot) setTyping(NOT_TYPING);
      setError(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const uploadAndSend = async (uri: string, fileName: string, contentType: string, reportedSizeBytes: number) => {
    // The presign must declare the exact byte count S3 will receive - the picker's own figure can be missing.
    const fileSizeBytes = await pickedFileSize(uri, reportedSizeBytes);
    if (fileSizeBytes > MAX_ATTACHMENT_BYTES) {
      setError(t('chat.fileTooLarge'));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const presigned = await presignChatAttachment(schoolId, conversationId, {
        fileName,
        contentType,
        fileSizeBytes,
      });
      await putToPresignedUrl(presigned.uploadUrl, uri, contentType);
      if (isBot) setTyping(startTyping(Date.now()));
      await sendMessage(schoolId, conversationId, draft.trim(), {
        attachmentObjectKey: presigned.objectKey,
        attachmentContentType: contentType,
        attachmentFileName: fileName,
      });
      setDraft('');
    } catch (e) {
      if (isBot) setTyping(NOT_TYPING);
      setError(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('chat.permissionTitle'), t('chat.photoPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const fileName = asset.fileName ?? `photo-${Date.now()}.jpg`;
    const contentType = asset.mimeType ?? 'image/jpeg';
    const fileSizeBytes = asset.fileSize ?? 0;
    await uploadAndSend(asset.uri, fileName, contentType, fileSizeBytes);
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const contentType = asset.mimeType ?? 'application/pdf';
    const fileSizeBytes = asset.size ?? 0;
    await uploadAndSend(asset.uri, asset.name, contentType, fileSizeBytes);
  };

  const handleCopy = async (content: string) => {
    await Clipboard.setStringAsync(content);
    showToast(t('common.copied'), 'success');
  };

  /** Best effort after a lost connection: the confirm may still have gone through. */
  const refreshAction = (actionId: string) => {
    getBotAction(schoolId, actionId)
      .then((action) => {
        if (isBotAction(action)) applyAction(action);
      })
      .catch(() => {});
  };

  const decide = async (action: BotAction, kind: 'confirm' | 'cancel') => {
    if (decidingRef.current) return;
    decidingRef.current = true;
    setBusyAction({ id: action.id, kind });
    setActionErrors((prev) => withoutKey(prev, action.id));
    try {
      const updated =
        kind === 'confirm' ? await confirmBotAction(schoolId, action.id) : await cancelBotAction(schoolId, action.id);
      if (isBotAction(updated)) applyAction(updated);
    } catch (e) {
      if (e instanceof ApiError && e.errorCode === 'BOT_ACTION_NOT_PENDING' && isBotAction(e.data)) {
        // Saved, cancelled, expired or replaced meanwhile (another device, or the text command):
        // show the card as it is now, and say why in the app's language.
        applyAction(e.data);
        showToast(notPendingMessage(e.data.status, t) ?? getErrorMessage(e), 'info');
      } else {
        const message = getErrorMessage(e);
        setActionErrors((prev) => ({ ...prev, [action.id]: message }));
        showToast(message, 'error');
        if (isRetryable(e)) refreshAction(action.id);
      }
    } finally {
      decidingRef.current = false;
      setBusyAction(null);
    }
  };

  // One alert with the number of changes: the card lists them, and this guards a stray tap on
  // something that pushes to whole classes. It repeats the class access a save grants and the
  // reason the teachers will see.
  const handleConfirmAction = (action: BotAction) => {
    if (decidingRef.current || confirmAlertOpenRef.current) return;
    confirmAlertOpenRef.current = true;
    const close = () => {
      confirmAlertOpenRef.current = false;
    };
    Alert.alert(
      t('helpdeskBot.card.confirmTitle', { count: action.changeCount }),
      confirmAlertBody(action, t),
      [
        { text: t('helpdeskBot.card.notNow'), style: 'cancel', onPress: close },
        {
          text: t('helpdeskBot.card.save'),
          onPress: () => {
            close();
            decide(action, 'confirm');
          },
        },
      ],
      { cancelable: true, onDismiss: close }
    );
  };

  // Cancel saves nothing, so it asks nothing.
  const handleCancelAction = (action: BotAction) => {
    if (decidingRef.current) return;
    decide(action, 'cancel');
  };

  const viewer = useMemo(
    () => ({ ownerType: session.ownerType, ownerId: session.ownerId }),
    [session.ownerType, session.ownerId]
  );
  // What the rows draw besides the message itself, so FlatList re-renders them when it changes
  // (`t` too: the card handlers word their toasts with it).
  const rowState = useMemo(
    () => ({ busyAction, actionErrors, receivedAt, viewer, t }),
    [busyAction, actionErrors, receivedAt, viewer, t]
  );
  const showTyping = isBot && typing.since !== null;

  const handleAttach = () => {
    Alert.alert(t('chat.attachTitle'), undefined, [
      { text: t('chat.attachPhoto'), onPress: handlePickImage },
      { text: t('chat.attachPdf'), onPress: handlePickDocument },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMine = item.senderOwnerId === session.ownerId;
    const fromBot = item.senderKind === 'BOT';
    const isImage = item.attachmentContentType?.startsWith('image/');
    // A card hides the plain-text footer the server adds for older apps.
    const text = visibleContent(item);
    const action = fromBot ? (item.action ?? null) : null;
    return (
      <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : fromBot ? styles.bubbleBot : styles.bubbleTheirs,
            action && styles.bubbleWithCard,
          ]}
        >
          {/* The card stays outside the long-press area: a Pressable is one accessibility element,
              so VoiceOver couldn't reach Confirm and Cancel inside it. */}
          <Pressable onLongPress={() => text && handleCopy(text)}>
            {item.attachmentUrl && isImage && (
              <Pressable onPress={() => Linking.openURL(item.attachmentUrl!)}>
                <Image source={{ uri: item.attachmentUrl }} style={styles.attachmentImage} resizeMode="cover" />
              </Pressable>
            )}
            {item.attachmentUrl && !isImage && (
              <Pressable style={styles.fileChip} onPress={() => Linking.openURL(item.attachmentUrl!)}>
                <FontAwesome5 name="file-pdf" size={16} color={isMine ? colors.white : colors.primary} />
                <Text style={[styles.fileChipText, isMine && styles.bubbleTextMine]} numberOfLines={1}>
                  {item.attachmentFileName ?? t('chat.attachment')}
                </Text>
              </Pressable>
            )}
            {text ? (
              <Text
                selectable
                style={[styles.bubbleText, isMine && styles.bubbleTextMine, item.attachmentUrl && styles.bubbleTextWithAttachment]}
              >
                {text}
              </Text>
            ) : null}
          </Pressable>
          {action ? (
            <BotActionCard
              action={action}
              viewer={rowState.viewer}
              receivedAtMs={rowState.receivedAt[actionClockKey(action)] ?? Date.parse(action.serverTime)}
              busy={rowState.busyAction?.id === action.id ? rowState.busyAction.kind : null}
              error={rowState.actionErrors[action.id] ?? null}
              onConfirm={handleConfirmAction}
              onCancel={handleCancelAction}
            />
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingBottom: androidKeyboardInset }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      {isBot ? (
        <>
          <AiNoticeBar onPress={() => setRecordsOpen(true)} />
          <AiMyRecordsSheet schoolId={schoolId} visible={recordsOpen} onClose={() => setRecordsOpen(false)} />
        </>
      ) : null}
      {loading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          ref={listRef}
          style={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          extraData={rowState}
          ListFooterComponent={showTyping ? <Text style={styles.typing}>{t('helpdeskBot.typing')}</Text> : null}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}
      {error && <ErrorNotice message={error} />}
      {isBot && pausedUntil ? (
        <AiPausedBanner kind="paused" pausedUntil={pausedUntil} />
      ) : isBot && !botEnabled ? (
        <AiPausedBanner kind="off" />
      ) : null}
      <View style={[styles.inputRow, { paddingBottom: composerBottomPadding }]}>
        <Pressable
          style={[styles.attachButton, aiPaused && styles.composerLocked]}
          onPress={handleAttach}
          disabled={uploading || aiPaused}
        >
          {uploading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <FontAwesome5 name="paperclip" size={18} color={colors.primary} />
          )}
        </Pressable>
        <TextInput
          style={[styles.input, aiPaused && styles.composerLocked]}
          placeholder={t('chat.messagePlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          editable={!aiPaused}
          multiline
        />
        <Pressable
          style={[styles.sendButton, aiPaused && styles.composerLocked]}
          onPress={handleSend}
          disabled={uploading || sending || aiPaused}
        >
          {sending ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.sendButtonText}>{t('chat.send')}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  list: { flex: 1 },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bubbleBot: { backgroundColor: colors.primaryLight },
  bubbleWithCard: { maxWidth: '92%' },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleText: { fontSize: 15, color: colors.textPrimary },
  bubbleTextMine: { color: colors.white },
  bubbleTextWithAttachment: { marginTop: spacing.xs },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    maxWidth: 220,
  },
  fileChipText: { fontSize: 13, color: colors.textPrimary, flexShrink: 1 },
  error: { color: colors.error, paddingHorizontal: spacing.lg, fontSize: 13 },
  typing: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', paddingVertical: spacing.xs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  sendButtonText: { color: colors.white, fontWeight: '700' },
  composerLocked: { opacity: 0.5 },
});
