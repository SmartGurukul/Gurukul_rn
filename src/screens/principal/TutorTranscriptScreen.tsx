import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { getTutorSession } from '../../api/tutor';
import type { TutorSessionView, TutorTurnView } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing, tints } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';
import { dateTime, transcriptItems } from '../../utils/tutorReport';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TutorTranscript'>;

function Turn({ turn }: { turn: TutorTurnView }) {
  if (turn.role === 'SYSTEM') {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{turn.content}</Text>
      </View>
    );
  }
  const mine = turn.role === 'STUDENT';
  return (
    <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapStudent : styles.bubbleWrapTutor]}>
      <View style={[styles.bubble, mine ? styles.bubbleStudent : styles.bubbleTutor]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextStudent]}>{turn.content}</Text>
      </View>
      {!mine && turn.citations.length > 0 && (
        <View style={styles.citations}>
          {turn.citations.map((citation) => (
            <Text key={citation.chunkId} style={styles.citation} numberOfLines={2}>
              {citation.citation}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * A finished (or running) tutor session read back as a chat: student on the right, tutor on the
 * left, the stage named when it changes. Role-neutral: a student reads their own session, a parent
 * their child's, an admin anyone's - the server decides who may read what.
 */
export function TutorTranscriptScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { sessionId } = route.params;
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const [session, setSession] = useState<TutorSessionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getTutorSession(schoolId, sessionId)
      .then((s) => {
        setSession(s);
        setError(null);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId, sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const title = session ? t('tutorParent.transcript.chapter', { number: session.chapterNumber, title: session.chapterTitle }) : t('tutorParent.transcript.title');
  const subtitle = session ? `${session.bookTitle} · ${dateTime(session.startedAt, locale)}` : undefined;

  return (
    <View style={styles.root}>
      <ScreenHeader title={title} subtitle={subtitle} onBack={() => navigation.goBack()} />
      {error && !session ? (
        <ScreenContainer>
          <ErrorNotice message={error} />
          <Pressable onPress={() => { setError(null); load(); }} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </ScreenContainer>
      ) : !session ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <ScreenContainer>
          {session.flaggedReason ? (
            <View style={styles.flagged} accessibilityRole="alert">
              <FontAwesome5 name="flag" size={14} color={colors.warning} />
              <Text style={styles.flaggedText}>{t('tutorParent.transcript.flagged')}</Text>
            </View>
          ) : null}

          {session.summary || session.parentNote ? (
            <View style={styles.summaryCard}>
              {session.summary ? (
                <>
                  <Text style={styles.summaryLabel}>{t('tutorParent.transcript.summary')}</Text>
                  <Text style={styles.summaryText}>{session.summary}</Text>
                </>
              ) : null}
              {session.parentNote ? (
                <>
                  <Text style={[styles.summaryLabel, session.summary && styles.summaryLabelSpaced]}>{t('tutorParent.transcript.parentNote')}</Text>
                  <Text style={styles.summaryText}>{session.parentNote}</Text>
                </>
              ) : null}
            </View>
          ) : null}

          <View style={styles.meta}>
            <Text style={styles.metaText}>
              {t(`tutorParent.transcript.status.${session.status}`)} · {t('tutorParent.transcript.turns', { count: session.turnCount })}
              {session.xpAwarded ? ` · ${t('tutorParent.transcript.xp', { xp: session.xpAwarded })}` : ''}
            </Text>
          </View>

          {transcriptItems(session.turns).map((item) =>
            item.kind === 'stage' ? (
              <View key={item.key} style={styles.stageWrap}>
                <Text style={styles.stageText}>{t(`tutorParent.stage.${item.stage}`)}</Text>
              </View>
            ) : (
              <Turn key={item.key} turn={item.turn} />
            )
          )}
          {session.turns.length === 0 && <Text style={styles.empty}>{t('tutorParent.transcript.empty')}</Text>}
        </ScreenContainer>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  retryText: { color: colors.primary, fontFamily: fonts.headingMedium, fontSize: 14 },
  flagged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  flaggedText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14, lineHeight: 20, color: colors.warning },
  summaryCard: { backgroundColor: tints.sky.bg, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md },
  summaryLabel: { fontFamily: fonts.headingMedium, fontSize: 13, lineHeight: 18, color: tints.sky.fg, marginBottom: 2 },
  summaryLabelSpaced: { marginTop: spacing.md },
  summaryText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textPrimary },
  meta: { alignItems: 'center', marginBottom: spacing.sm },
  metaText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  stageWrap: { alignItems: 'center', marginVertical: spacing.md },
  stageText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    lineHeight: 16,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  systemWrap: { alignItems: 'center', marginVertical: spacing.sm, paddingHorizontal: spacing.lg },
  systemText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, textAlign: 'center' },
  bubbleWrap: { marginBottom: spacing.sm, maxWidth: '85%' },
  bubbleWrapStudent: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapTutor: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: radius.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  bubbleStudent: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleTutor: { backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textPrimary },
  bubbleTextStudent: { color: colors.onPrimary },
  citations: { marginTop: 4, paddingLeft: spacing.sm, gap: 2 },
  citation: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.textMuted },
  empty: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
