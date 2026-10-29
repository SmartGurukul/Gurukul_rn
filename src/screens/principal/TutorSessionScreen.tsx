import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AudioQuality, IOSOutputFormat, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, type RecordingOptions } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError } from '../../api/client';
import { getErrorMessage } from '../../api/errorMessage';
import { closeTutorSession, getMyTutorAccess, getTutorSession, sendTutorTurn, transcribeTutorAudio } from '../../api/tutor';
import type { TutorCitation, TutorSessionView, TutorStage, TutorTurnView } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenHeader, headerButtonStyle } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useComposerBottomPadding } from '../../hooks/useComposerBottomPadding';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { colors, radius, spacing, tints } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';
import { latestTutorTurn, stageLabelKey, TUTOR_STAGES, visibleTurns } from '../../utils/tutor';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TutorSession'>;

/** Longest clip the server accepts (contract: ≤ 60 s, ≤ 10 MB). */
const MAX_RECORDING_SECONDS = 60;

/**
 * Speech only, mono, 16 kHz, 32 kbps AAC: about 4 KB a second, so a full minute stays near 250 KB.
 * The server's front proxy caps uploads at 1 MB and the stereo 128 kbps preset went past it, which
 * the phone reported as a network failure.
 */
const SPEECH_RECORDING: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: { extension: '.m4a', outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { extension: '.m4a', outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
};

const SPEECH_OPTIONS: Speech.SpeechOptions = { language: 'en-IN', rate: 0.95 };

/**
 * A live tutoring session: the turns so far, the stage strip, the tutor's citations, and a
 * composer that takes typing or a short voice clip. The server owns the plan and the stage; the
 * screen only shows what each turn result says. When the tutor closes the session (or the student
 * ends it), the end state replaces the composer.
 */
export function TutorSessionScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { sessionId } = route.params;
  const androidKeyboardInset = useKeyboardInset(Platform.OS === 'android');
  const composerBottomPadding = useComposerBottomPadding();
  const listRef = useRef<FlatList<TutorTurnView>>(null);

  const [session, setSession] = useState<TutorSessionView | null>(route.params.session ?? null);
  const [loading, setLoading] = useState(!route.params.session);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [turns, setTurns] = useState<TutorTurnView[]>(route.params.session?.turns ?? []);
  const [stage, setStage] = useState<TutorStage | null>(route.params.session?.stage ?? null);
  const [ended, setEnded] = useState(route.params.session ? route.params.session.status !== 'ACTIVE' : false);
  // The guard's text for the latest reply, shown above that bubble until the next reply.
  const [notice, setNotice] = useState<{ turnId: string; text: string } | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [speakOn, setSpeakOn] = useState(route.params.session?.mode === 'VOICE');
  const [citation, setCitation] = useState<TutorCitation | null>(null);

  // Voice input. The mic hides for the rest of the session once the server says it has no
  // speech provider (TUTOR_STT_UNAVAILABLE); its message is shown once.
  const recorder = useAudioRecorder(SPEECH_RECORDING);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  // Hidden until the server says it has a speech provider, so nothing is recorded that cannot be heard.
  const [micHidden, setMicHidden] = useState(true);
  useEffect(() => {
    let cancelled = false;
    getMyTutorAccess(schoolId)
      .then((access) => {
        if (!cancelled) setMicHidden(!access.voiceInputAvailable);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [schoolId]);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  // Which tutor reply was last read aloud, so resuming a session does not re-read old turns.
  const lastSpoken = useRef<string | null>(null);

  useEffect(() => {
    if (route.params.session) return;
    let cancelled = false;
    getTutorSession(schoolId, sessionId)
      .then((view) => {
        if (cancelled) return;
        setSession(view);
        setTurns(view.turns);
        setStage(view.stage);
        setEnded(view.status !== 'ACTIVE');
        setSpeakOn(view.mode === 'VOICE');
        lastSpoken.current = latestTutorTurn(view.turns)?.id ?? null;
      })
      .catch((e) => {
        if (!cancelled) setLoadError(getErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId, sessionId, route.params.session]);

  // Read each new tutor reply aloud while the speaker is on; stop whatever is still playing first.
  const latest = latestTutorTurn(turns);
  useEffect(() => {
    if (!latest || latest.id === lastSpoken.current) return;
    lastSpoken.current = latest.id;
    if (!speakOn) return;
    Speech.stop().catch(() => {});
    Speech.speak(latest.content, SPEECH_OPTIONS);
  }, [latest, speakOn]);

  useEffect(
    () => () => {
      Speech.stop().catch(() => {});
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (tick.current) clearInterval(tick.current);
    },
    [],
  );

  const toggleSpeaker = () => {
    if (speakOn) Speech.stop().catch(() => {});
    setSpeakOn((on) => !on);
  };

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending || ended) return;
      const localTurn: TutorTurnView = {
        id: `local-${Date.now()}`,
        seq: turns.length + 1,
        role: 'STUDENT',
        stage,
        content,
        citations: [],
        topicId: null,
        createdAt: new Date().toISOString(),
        latencyMs: null,
      };
      setTurns((prev) => [...prev, localTurn]);
      setInput('');
      setSending(true);
      setSendError(null);
      try {
        const result = await sendTutorTurn(schoolId, sessionId, content);
        setTurns((prev) => [...prev, result.turn]);
        setStage(result.stage);
        setNotice(result.notice ? { turnId: result.turn.id, text: result.notice } : null);
        if (result.sessionEnded || result.status !== 'ACTIVE') {
          setEnded(true);
          // The closed view carries the summary and XP; the reply itself is already on screen.
          getTutorSession(schoolId, sessionId)
            .then(setSession)
            .catch(() => {});
        }
      } catch (e) {
        setSendError(getErrorMessage(e));
        setTurns((prev) => prev.filter((turn) => turn.id !== localTurn.id));
        setInput(content);
      } finally {
        setSending(false);
      }
    },
    [ended, schoolId, sending, sessionId, stage, turns.length],
  );

  const clearRecordingTimers = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (tick.current) clearInterval(tick.current);
    stopTimer.current = null;
    tick.current = null;
  };

  const stopRecording = useCallback(async () => {
    clearRecordingTimers();
    setRecording(false);
    try {
      await recorder.stop();
    } catch {
      return;
    } finally {
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
    const uri = recorder.uri;
    if (!uri) return;
    setTranscribing(true);
    setMicNotice(null);
    try {
      const { text } = await transcribeTutorAudio(schoolId, { uri, name: 'answer.m4a', type: 'audio/m4a' });
      const spoken = text.trim();
      if (!spoken) {
        setMicNotice(t('tutor.session.nothingHeard'));
      } else if (session?.mode === 'VOICE') {
        await send(spoken);
      } else {
        setInput((current) => (current.trim() ? `${current.trim()} ${spoken}` : spoken));
      }
    } catch (e) {
      if (e instanceof ApiError && e.errorCode === 'TUTOR_STT_UNAVAILABLE') {
        setMicHidden(true);
        setMicNotice(e.message || t('tutor.session.voiceUnavailable'));
      } else {
        setMicNotice(getErrorMessage(e));
      }
    } finally {
      setTranscribing(false);
    }
  }, [recorder, schoolId, send, session?.mode, t]);

  const startRecording = async () => {
    if (recording || transcribing || sending) return;
    setMicNotice(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setMicNotice(t('tutor.session.micDenied'));
        return;
      }
      Speech.stop().catch(() => {});
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setSeconds(0);
      tick.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      stopTimer.current = setTimeout(() => void stopRecording(), MAX_RECORDING_SECONDS * 1000);
    } catch (e) {
      setRecording(false);
      clearRecordingTimers();
      setMicNotice(getErrorMessage(e));
    }
  };

  const confirmEnd = () => {
    Alert.alert(t('tutor.session.endTitle'), t('tutor.session.endMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tutor.session.endConfirm'),
        style: 'destructive',
        onPress: async () => {
          setClosing(true);
          try {
            const view = await closeTutorSession(schoolId, sessionId);
            Speech.stop().catch(() => {});
            setSession(view);
            setTurns(view.turns.length ? view.turns : turns);
            setStage(view.stage);
            setEnded(true);
          } catch (e) {
            setSendError(getErrorMessage(e));
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  };

  const shown = visibleTurns(turns);
  const canSend = !!input.trim() && !sending && !ended && !recording && !transcribing;

  const renderTurn = ({ item }: { item: TutorTurnView }) => {
    const mine = item.role === 'STUDENT';
    return (
      <View style={[styles.turn, mine ? styles.turnMine : styles.turnTutor]}>
        {notice && notice.turnId === item.id && (
          <View style={styles.noticeBanner} accessibilityRole="alert">
            <FontAwesome5 name="info-circle" size={13} color={tints.marigold.fg} />
            <Text style={styles.noticeText}>{notice.text}</Text>
          </View>
        )}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTutor]}>
          <Text selectable style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
            {item.content}
          </Text>
        </View>
        {!mine && item.citations.length > 0 && (
          <View style={styles.citations}>
            {item.citations.map((c) => (
              <Pressable key={c.chunkId} style={styles.citationChip} onPress={() => setCitation(c)} accessibilityRole="button">
                <FontAwesome5 name="book-open" size={10} color={tints.sky.fg} />
                <Text style={styles.citationText} numberOfLines={1}>
                  {c.citation}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  const title = session ? `${session.chapterNumber}. ${session.chapterTitle}` : t('tutor.title');

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={title}
        subtitle={session?.bookTitle}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerActions}>
            <Pressable
              style={[headerButtonStyle, speakOn && styles.headerButtonOn]}
              onPress={toggleSpeaker}
              accessibilityRole="button"
              accessibilityLabel={t(speakOn ? 'tutor.session.speakerOff' : 'tutor.session.speakerOn')}
            >
              <FontAwesome5 name={speakOn ? 'volume-up' : 'volume-mute'} size={16} color={speakOn ? colors.white : colors.textPrimary} />
            </Pressable>
            {!ended && (
              <Pressable
                style={headerButtonStyle}
                onPress={confirmEnd}
                disabled={closing}
                accessibilityRole="button"
                accessibilityLabel={t('tutor.session.end')}
              >
                {closing ? <ActivityIndicator size="small" color={colors.error} /> : <FontAwesome5 name="stop" size={14} color={colors.error} />}
              </Pressable>
            )}
          </View>
        }
      >
        <View style={styles.stageStrip}>
          {TUTOR_STAGES.map((s) => {
            const active = s === stage;
            return (
              <View key={s} style={[styles.stagePill, active && styles.stagePillActive]}>
                <Text style={[styles.stageText, active && styles.stageTextActive]}>{t(stageLabelKey(s))}</Text>
              </View>
            );
          })}
        </View>
      </ScreenHeader>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : loadError ? (
        <ErrorNotice message={loadError} inset />
      ) : (
        <KeyboardAvoidingView
          style={[styles.flex, { paddingBottom: androidKeyboardInset }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            ref={listRef}
            data={shown}
            keyExtractor={(item) => item.id}
            renderItem={renderTurn}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={
              ended && session ? (
                <View style={styles.endCard}>
                  <Text style={styles.endTitle}>{t('tutor.session.endedTitle')}</Text>
                  {session.summary ? <Text style={styles.endSummary}>{session.summary}</Text> : null}
                  {!!session.xpAwarded && (
                    <View style={styles.xpBadge}>
                      <FontAwesome5 name="star" size={12} color={colors.warning} />
                      <Text style={styles.xpText}>{t('tutor.session.xp', { xp: session.xpAwarded })}</Text>
                    </View>
                  )}
                  <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('TutorChapters')} accessibilityRole="button">
                    <Text style={styles.primaryButtonText}>{t('tutor.session.backToChapters')}</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('TutorSessions')} accessibilityRole="button">
                    <Text style={styles.secondaryButtonText}>{t('tutor.session.seeSessions')}</Text>
                  </Pressable>
                </View>
              ) : null
            }
          />

          {sending && (
            <View style={styles.thinkingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.thinkingText}>{t('tutor.session.thinking')}</Text>
            </View>
          )}
          {sendError && <ErrorNotice message={sendError} inset />}
          {micNotice && (
            <View style={styles.micNotice}>
              <Text style={styles.micNoticeText}>{micNotice}</Text>
            </View>
          )}

          {!ended && (
            <View style={[styles.inputRow, { paddingBottom: composerBottomPadding }]}>
              {recording ? (
                <View style={styles.recordingRow}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>{t('tutor.session.recording', { seconds })}</Text>
                  <Pressable style={styles.stopButton} onPress={() => void stopRecording()} accessibilityRole="button">
                    <FontAwesome5 name="stop" size={12} color={colors.white} />
                    <Text style={styles.stopText}>{t('tutor.session.stop')}</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {!micHidden && (
                    <Pressable
                      style={[styles.micButton, (transcribing || sending) && styles.disabled]}
                      onPress={startRecording}
                      disabled={transcribing || sending}
                      accessibilityRole="button"
                      accessibilityLabel={t('tutor.session.speak')}
                    >
                      {transcribing ? <ActivityIndicator size="small" color={colors.primary} /> : <FontAwesome5 name="microphone" size={16} color={colors.primary} />}
                    </Pressable>
                  )}
                  <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder={t('tutor.session.placeholder')}
                    placeholderTextColor={colors.textMuted}
                    editable={!sending && !transcribing}
                    multiline
                  />
                  <Pressable style={[styles.sendButton, !canSend && styles.disabled]} onPress={() => send(input)} disabled={!canSend} accessibilityRole="button">
                    <Text style={styles.sendText}>{t('tutor.session.send')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      <Modal visible={citation !== null} transparent animationType="fade" onRequestClose={() => setCitation(null)}>
        <Pressable style={styles.backdrop} onPress={() => setCitation(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetLabel}>{t('tutor.session.fromTextbook')}</Text>
            <Text style={styles.sheetText} selectable>
              {citation?.citation}
            </Text>
            {citation?.pageFrom != null && <Text style={styles.sheetHint}>{t('tutor.session.page', { page: citation.pageFrom })}</Text>}
            <Pressable style={styles.secondaryButton} onPress={() => setCitation(null)}>
              <Text style={styles.secondaryButtonText}>{t('common.done')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loading: { marginTop: spacing.xxl },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  headerButtonOn: { backgroundColor: colors.primary },
  stageStrip: { flexDirection: 'row', gap: spacing.xs },
  stagePill: { flex: 1, borderRadius: radius.pill, paddingVertical: 5, alignItems: 'center', backgroundColor: colors.surface },
  stagePillActive: { backgroundColor: colors.primary },
  stageText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.textMuted },
  stageTextActive: { color: colors.white },
  listContent: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.sm },
  turn: { marginBottom: spacing.md, maxWidth: '88%' },
  turnMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  turnTutor: { alignSelf: 'flex-start' },
  bubble: { borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleTutor: { backgroundColor: tints.violet.bg, borderBottomLeftRadius: radius.sm },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textPrimary },
  bubbleTextMine: { color: colors.white },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: tints.marigold.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: tints.marigold.fg },
  citations: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  citationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tints.sky.bg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    maxWidth: 240,
  },
  citationText: { fontFamily: fonts.body, fontSize: 11, color: tints.sky.fg, flexShrink: 1 },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  thinkingText: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 13 },
  micNotice: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: tints.marigold.bg, borderRadius: radius.md, padding: spacing.sm },
  micNoticeText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: tints.marigold.fg },
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
  micButton: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: tints.violet.bg, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  sendButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: 'center' },
  sendText: { color: colors.white, fontFamily: fonts.headingMedium, fontSize: 15 },
  disabled: { opacity: 0.5 },
  recordingRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  recordingText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textPrimary },
  stopButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.error, borderRadius: radius.pill, paddingHorizontal: spacing.lg, minHeight: 44 },
  stopText: { color: colors.white, fontFamily: fonts.headingMedium, fontSize: 15 },
  endCard: { backgroundColor: tints.mint.bg, borderRadius: radius.xxl, padding: spacing.lg, marginTop: spacing.sm, gap: spacing.sm },
  endTitle: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24, color: colors.textPrimary },
  endSummary: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  xpBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', backgroundColor: colors.warningLight, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  xpText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.warning },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  primaryButtonText: { color: colors.white, fontFamily: fonts.headingMedium, fontSize: 15 },
  secondaryButton: { alignItems: 'center', paddingVertical: spacing.sm },
  secondaryButtonText: { color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(30, 22, 51, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  sheetLabel: { fontFamily: fonts.label, fontSize: 13, color: tints.sky.fg },
  sheetText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textPrimary },
  sheetHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
});
