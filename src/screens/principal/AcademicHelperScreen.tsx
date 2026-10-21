import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useComposerBottomPadding } from '../../hooks/useComposerBottomPadding';
import { askAi } from '../../api/ai';
import { AiMyRecordsSheet } from '../../components/AiMyRecordsSheet';
import { AiNoticeBar } from '../../components/AiNoticeBar';
import { AiPausedBanner } from '../../components/AiPausedBanner';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { useToast } from '../../context/ToastContext';
import { useAiStatus } from '../../hooks/useAiStatus';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import {
  errorMaySayOff,
  historyForRequest,
  pausedUntilFromError,
  pausedUntilFromReply,
  replyEntry,
  type AiChatEntry,
} from '../../utils/aiGuard';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AcademicHelper'>;

type Message = AiChatEntry;

const accent = accents.academicHelper;

/**
 * Open-ended tutoring for students, teaching support for staff. Distinct from HelpdeskBotScreen,
 * which answers questions about the user's own attendance/fees/subjects using real school data.
 *
 * The system prompt used to live here, alongside a student/teacher toggle the user could flip. Both
 * moved to the backend (AiChatService), which selects the prompt from the caller's role in the JWT.
 * That toggle was a real hole: a student could switch to teacher mode and ask for complete answer
 * keys to their own homework.
 *
 * School work only: the server checks every question first. A refused one comes back as a fixed
 * text (`refused: true`), shown muted and left out of what is sent next time. After repeated
 * refusals the user's AI help is paused for a while: the composer locks until then.
 */
export function AcademicHelperScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const androidKeyboardInset = useKeyboardInset(Platform.OS === 'android');
  const { session } = useAuth();
  const { showToast } = useToast();
  const composerBottomPadding = useComposerBottomPadding();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const { pausedUntil, assistantEnabled, enterPaused, refresh: refreshAiStatus } = useAiStatus(schoolId);
  const locked = pausedUntil !== null || !assistantEnabled;

  // Presentation only - it just picks the empty-state wording. The actual behaviour is decided
  // server-side from the JWT, so this can't be used to change how the assistant answers.
  const isStudent = session.ownerType === 'STUDENT';

  const handleCopy = async (content: string) => {
    await Clipboard.setStringAsync(content);
    showToast(t('common.copied'), 'success');
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || sending || locked) return;

    const userMessage: Message = { id: `${Date.now()}-u`, role: 'user', content: question };
    const conversation = [...messages, userMessage];
    setMessages(conversation);
    setInput('');
    setSending(true);

    try {
      // Refused and supportive exchanges stay on screen but aren't sent again.
      const response = await askAi(schoolId, historyForRequest(conversation));
      // The reply is stored exactly as received, so it can be re-sent unchanged (see replyEntry).
      setMessages((prev) => [...prev, replyEntry(`${Date.now()}-a`, response)]);
      // The refusal that starts a pause says so itself: lock now, not on the next send.
      enterPaused(pausedUntilFromReply(response));
    } catch (e) {
      // Paused (from another device, or the status hadn't caught up): the banner says until when.
      // A pause that has already ended by this phone's clock shows no banner, so it gets the toast.
      if (!enterPaused(pausedUntilFromError(e))) {
        // getErrorMessage words the server's codes (limits, too long) in the app's language, and
        // keeps the server's own text where it says something specific.
        showToast(getErrorMessage(e), 'error');
      }
      // "Turned off" since the screen opened (that takes a server restart): read the status again,
      // so the "off" banner shows and the composer locks instead of every send failing.
      if (errorMaySayOff(e)) refreshAiStatus();
      // Drop the unanswered question back into the input so a retry doesn't mean retyping it.
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      setInput(question);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('academicHelper.title')} onBack={() => navigation.goBack()} />
      <AiNoticeBar onPress={() => setRecordsOpen(true)} />
      <AiMyRecordsSheet schoolId={schoolId} visible={recordsOpen} onClose={() => setRecordsOpen(false)} />

      <KeyboardAvoidingView
        style={[styles.flex, { paddingBottom: androidKeyboardInset }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          keyboardShouldPersistTaps="handled"
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isStudent ? t('academicHelper.emptyStudent') : t('academicHelper.emptyTeacher')}
            </Text>
          }
          renderItem={({ item }) =>
            item.refused ? (
              // A fixed text from the server's school-work check, not an answer: muted, with an
              // info icon, and left out of what is sent next time.
              <Pressable
                onLongPress={() => handleCopy(item.content)}
                style={[styles.bubble, styles.bubbleAssistant, styles.bubbleRefused]}
                accessibilityHint={t('ai.refusedHint')}
              >
                <FontAwesome5 name="info-circle" size={14} color={colors.textMuted} style={styles.refusedIcon} />
                <Text selectable style={styles.bubbleTextRefused}>
                  {item.content}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onLongPress={() => handleCopy(item.content)}
                style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}
              >
                <Text
                  selectable
                  style={item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant}
                >
                  {item.content}
                </Text>
              </Pressable>
            )
          }
        />

        {sending && (
          <View style={styles.thinkingRow}>
            <ActivityIndicator size="small" color={accent.base} />
            <Text style={styles.thinkingText}>{t('academicHelper.thinking')}</Text>
          </View>
        )}

        {pausedUntil ? (
          <AiPausedBanner kind="paused" pausedUntil={pausedUntil} />
        ) : !assistantEnabled ? (
          <AiPausedBanner kind="off" />
        ) : null}

        <View style={[styles.inputRow, { paddingBottom: composerBottomPadding }]}>
          <TextInput
            style={[styles.input, locked && styles.inputLocked]}
            value={input}
            onChangeText={setInput}
            placeholder={t('academicHelper.inputPlaceholder')}
            placeholderTextColor={colors.textMuted}
            editable={!locked}
            multiline
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || sending || locked) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending || locked}
          >
            <Text style={styles.sendText}>{t('academicHelper.send')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  listContent: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 60, paddingHorizontal: spacing.xl },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  bubbleUser: {
    backgroundColor: accent.base,
    alignSelf: 'flex-end',
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  bubbleTextUser: { color: colors.white, fontSize: 15 },
  bubbleTextAssistant: { color: colors.textPrimary, fontSize: 15 },
  bubbleRefused: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  refusedIcon: { marginTop: 3 },
  bubbleTextRefused: { flexShrink: 1, color: colors.textSecondary, fontSize: 14 },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  thinkingText: { color: colors.textMuted, fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 15,
  },
  inputLocked: { opacity: 0.6 },
  sendButton: {
    backgroundColor: accent.base,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendText: { color: colors.white, fontWeight: '700' },
});
