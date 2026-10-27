import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '../../api/errorMessage';
import { getMyTutorAccess, getTutorChapters, listTutorSessions, startTutorSession } from '../../api/tutor';
import type { TutorAccess, TutorChapterOption, TutorSessionMode, TutorSessionSummary } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader, headerButtonStyle } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing, tints } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';
import { accessReasonKey, activeSession, groupChaptersBySubject, masteryPercent } from '../../utils/tutor';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TutorChapters'>;

/**
 * The AI Tutor's front door for a student: access (sessions left, or why it is locked), a running
 * session to pick up, this week's quiz, and the grade's chapters by subject. A chapter opens a
 * Text / Voice choice and starts a session. Locked students still see the list, greyed out, so
 * they know what the tutor covers.
 */
export function TutorChaptersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [access, setAccess] = useState<TutorAccess | null>(null);
  const [chapters, setChapters] = useState<TutorChapterOption[] | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const [current, setCurrent] = useState<TutorSessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [picking, setPicking] = useState<TutorChapterOption | null>(null);
  const [starting, setStarting] = useState<TutorSessionMode | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [accessRes, chaptersRes, sessionsRes] = await Promise.all([
        getMyTutorAccess(schoolId),
        getTutorChapters(schoolId),
        listTutorSessions(schoolId).catch(() => ({ sessions: [] })),
      ]);
      setAccess(accessRes);
      setChapters(chaptersRes.chapters);
      setGrade(chaptersRes.grade);
      setCurrent(activeSession(sessionsRes.sessions));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, [schoolId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Coming back from a session (ended or not) changes "continue" and the mastery figures.
  useEffect(() => navigation.addListener('focus', () => void load()), [navigation, load]);

  const allowed = access?.allowed ?? false;
  const remaining = access?.entitlement?.sessionsRemaining ?? null;

  const start = async (mode: TutorSessionMode) => {
    if (!picking || starting) return;
    setStarting(mode);
    setStartError(null);
    try {
      const session = await startTutorSession(schoolId, picking.chapterId, mode);
      setPicking(null);
      navigation.navigate('TutorSession', { sessionId: session.id, session });
    } catch (e) {
      // TUTOR_NOT_ENTITLED (403) and TUTOR_CHAPTER_NOT_READY (400) carry a message written for the
      // student; getErrorMessage keeps the server's text for both.
      setStartError(getErrorMessage(e));
    } finally {
      setStarting(null);
    }
  };

  const groups = groupChaptersBySubject(chapters ?? []);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('tutor.title')}
        subtitle={grade ? t('tutor.chapters.grade', { grade }) : undefined}
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable
            style={headerButtonStyle}
            onPress={() => navigation.navigate('TutorSessions')}
            accessibilityRole="button"
            accessibilityLabel={t('tutor.sessions.title')}
          >
            <FontAwesome5 name="history" size={16} color={colors.textPrimary} />
          </Pressable>
        }
      />
      <ScreenContainer>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : error ? (
          <ErrorNotice message={error} />
        ) : (
          <>
            {allowed ? (
              <View style={[styles.hero, { backgroundColor: tints.violet.bg }]}>
                <Text style={[styles.heroLabel, { color: tints.violet.fg }]}>{t('tutor.chapters.sessionsLeft')}</Text>
                <Text style={styles.heroValue}>
                  {remaining === null ? t('tutor.chapters.unlimited') : String(remaining)}
                </Text>
                {current && (
                  <Pressable
                    style={styles.heroButton}
                    onPress={() => navigation.navigate('TutorSession', { sessionId: current.id })}
                    accessibilityRole="button"
                  >
                    <FontAwesome5 name="play" size={12} color={colors.white} />
                    <Text style={styles.heroButtonText}>{t('tutor.chapters.continueSession')}</Text>
                    <Text style={styles.heroButtonHint} numberOfLines={1}>
                      {current.chapterTitle}
                    </Text>
                  </Pressable>
                )}
                <Pressable style={styles.quizLink} onPress={() => navigation.navigate('TutorQuiz')} accessibilityRole="button">
                  <FontAwesome5 name="clipboard-check" size={14} color={tints.violet.fg} />
                  <Text style={[styles.quizLinkText, { color: tints.violet.fg }]}>{t('tutor.chapters.weeklyQuiz')}</Text>
                  <Text style={[styles.chevron, { color: tints.violet.fg }]}>›</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.hero, { backgroundColor: tints.marigold.bg }]} accessibilityRole="summary">
                <View style={styles.lockRow}>
                  <FontAwesome5 name="crown" size={14} color={tints.marigold.fg} />
                  <Text style={[styles.heroLabel, { color: tints.marigold.fg }]}>{t('tutor.access.premium')}</Text>
                </View>
                <Text style={styles.lockTitle}>{t('tutor.access.lockedTitle')}</Text>
                <Text style={styles.lockText}>{t(accessReasonKey(access?.reason))}</Text>
              </View>
            )}

            {startError && <ErrorNotice message={startError} />}

            {groups.length === 0 ? (
              <Text style={styles.empty}>{t('tutor.chapters.empty')}</Text>
            ) : (
              groups.map((group) => (
                <View key={group.subjectKey} style={styles.group}>
                  <Text style={styles.subject}>{group.subjectName}</Text>
                  <View style={styles.listBlock}>
                    {group.chapters.map((chapter, index) => {
                      const percent = masteryPercent(chapter.mastery);
                      const disabled = !allowed || !chapter.ingested;
                      return (
                        <Pressable
                          key={chapter.chapterId}
                          style={[styles.row, index === group.chapters.length - 1 && styles.rowLast, disabled && styles.rowDisabled]}
                          disabled={disabled}
                          onPress={() => {
                            setStartError(null);
                            setPicking(chapter);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ disabled }}
                          testID={`tutor-chapter-${chapter.chapterId}`}
                        >
                          <View style={styles.number}>
                            <Text style={styles.numberText}>{chapter.chapterNumber}</Text>
                          </View>
                          <View style={styles.rowText}>
                            <Text style={styles.rowTitle} numberOfLines={2}>
                              {chapter.title}
                            </Text>
                            {chapter.ingested ? (
                              percent !== null ? (
                                <View style={styles.masteryRow}>
                                  <View style={styles.masteryTrack}>
                                    <View style={[styles.masteryFill, { width: `${percent}%` }]} />
                                  </View>
                                  <Text style={styles.masteryText}>{t('tutor.chapters.mastery', { percent })}</Text>
                                </View>
                              ) : (
                                <Text style={styles.rowHint}>{t('tutor.chapters.notStarted')}</Text>
                              )
                            ) : (
                              <View style={styles.chipRow}>
                                <StatusChip label={t('tutor.chapters.notReady')} variant="neutral" />
                              </View>
                            )}
                          </View>
                          <Text style={styles.chevron}>›</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScreenContainer>

      <Modal visible={picking !== null} transparent animationType="fade" onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.backdrop} onPress={() => !starting && setPicking(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{picking?.title}</Text>
            <Text style={styles.sheetText}>{t('tutor.chapters.pickMode')}</Text>
            {(['TEXT', 'VOICE'] as const).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.modeButton, starting && styles.rowDisabled]}
                disabled={!!starting}
                onPress={() => start(mode)}
                accessibilityRole="button"
              >
                <View style={styles.modeIcon}>
                  <FontAwesome5 name={mode === 'TEXT' ? 'keyboard' : 'microphone'} size={16} color={tints.violet.fg} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.modeTitle}>{t(mode === 'TEXT' ? 'tutor.mode.text' : 'tutor.mode.voice')}</Text>
                  <Text style={styles.rowHint}>{t(mode === 'TEXT' ? 'tutor.mode.textHint' : 'tutor.mode.voiceHint')}</Text>
                </View>
                {starting === mode && <ActivityIndicator color={colors.primary} />}
              </Pressable>
            ))}
            <Pressable style={styles.cancel} onPress={() => setPicking(null)} disabled={!!starting}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xxl },
  hero: { borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.xs },
  heroLabel: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  heroValue: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, color: colors.textPrimary },
  heroButton: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  heroButtonText: { fontFamily: fonts.headingMedium, fontSize: 15, color: colors.white },
  heroButtonHint: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.onPrimaryMuted, textAlign: 'right' },
  quizLink: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  quizLinkText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lockTitle: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24, color: colors.textPrimary },
  lockText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  empty: { fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  group: { marginBottom: spacing.lg },
  subject: { fontFamily: fonts.headingMedium, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.sm },
  listBlock: { backgroundColor: colors.surface, borderRadius: radius.xxl, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  rowLast: { borderBottomWidth: 0 },
  rowDisabled: { opacity: 0.5 },
  number: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontFamily: fonts.headingMedium, fontSize: 13, color: colors.primary },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.textPrimary },
  rowHint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  chipRow: { flexDirection: 'row', marginTop: 2 },
  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  masteryTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.primaryLight, overflow: 'hidden' },
  masteryFill: { height: 6, borderRadius: 3, backgroundColor: colors.primaryBright },
  masteryText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.textSecondary, width: 36, textAlign: 'right' },
  chevron: { fontSize: 22, color: colors.textMuted, fontFamily: fonts.headingMedium },
  backdrop: { flex: 1, backgroundColor: 'rgba(30, 22, 51, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24, color: colors.textPrimary },
  sheetText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  modeIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: tints.violet.bg, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontFamily: fonts.headingMedium, fontSize: 15, color: colors.textPrimary },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.textSecondary },
});
