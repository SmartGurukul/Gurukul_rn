import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { setPublicBoard } from '../../api/auth';
import { getErrorMessage } from '../../api/errorMessage';
import { getMyTutorAccess, getTutorChapterMap, getTutorChapters, listTutorSessions, startTutorSession } from '../../api/tutor';
import type { Board, TutorAccess, TutorChapterOption, TutorKnowledgePoint, TutorSessionMode, TutorSessionSummary } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader, headerButtonStyle } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { isPublicSchool } from '../../config/publicSchool';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, spacing, tints } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';
import { accessReasonKey, activeSession, groupChaptersBySubject, masteryPercent } from '../../utils/tutor';
import { masteryColor, masteryLevel } from '../../utils/tutorReport';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TutorChapters'>;

const BOARDS: Board[] = ['CBSE', 'ICSE'];

/** A chapter's knowledge map as the row shows it: not asked for yet, loading, failed, or the points. */
type MapState = 'loading' | 'error' | TutorKnowledgePoint[];

/**
 * The mastery strip under a ready chapter: one small chip per knowledge point, grey before the
 * student has met it, red / marigold / green by mastery band. Tapping a chip opens its title and
 * one-line description.
 */
function MasteryStrip({ points, onPick }: { points: TutorKnowledgePoint[]; onPick: (point: TutorKnowledgePoint) => void }) {
  const { t } = useTranslation();
  if (points.length === 0) return null;
  return (
    <View style={styles.strip} testID="tutor-mastery-strip">
      {points.map((point) => (
        <Pressable
          key={point.id}
          style={[styles.pointChip, { backgroundColor: masteryColor(masteryLevel(point.mastery)) }]}
          onPress={() => onPick(point)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('tutor.map.chipLabel', { title: point.title, state: t(`tutorParent.mastery.${masteryLevel(point.mastery)}`) })}
          testID={`tutor-point-${point.id}`}
        />
      ))}
    </View>
  );
}

/**
 * The AI Tutor's front door for a student: access (sessions left, or why it is locked), a running
 * session to pick up, this week's quiz, and the grade's chapters by subject. A chapter opens a
 * Text / Voice choice and starts a session. Locked students still see the list, greyed out, so
 * they know what the tutor covers.
 */
export function TutorChaptersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  // Open School students follow no school: they pick their own board (the server keeps it).
  const isPublic = isPublicSchool(schoolId);
  const [access, setAccess] = useState<TutorAccess | null>(null);
  const [chapters, setChapters] = useState<TutorChapterOption[] | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const [changingBoard, setChangingBoard] = useState<Board | null>(null);
  const [current, setCurrent] = useState<TutorSessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [picking, setPicking] = useState<TutorChapterOption | null>(null);
  const [starting, setStarting] = useState<TutorSessionMode | null>(null);
  // Knowledge maps by chapter, fetched lazily: for chapters the student opened before, and on
  // demand ("Show points" / long press) for the rest, so the list stays one request per screen.
  const [maps, setMaps] = useState<Record<string, MapState>>({});
  const [point, setPoint] = useState<TutorKnowledgePoint | null>(null);

  // Chapters whose map is loaded or in flight, so a long press or a re-focus never fetches twice.
  const mapRequested = useRef(new Set<string>());

  const loadMap = useCallback(
    (chapterId: string) => {
      if (mapRequested.current.has(chapterId)) return;
      mapRequested.current.add(chapterId);
      setMaps((prev) => ({ ...prev, [chapterId]: 'loading' }));
      getTutorChapterMap(schoolId, chapterId)
        .then((map) => setMaps((prev) => ({ ...prev, [chapterId]: map.points })))
        .catch(() => {
          mapRequested.current.delete(chapterId);
          setMaps((prev) => ({ ...prev, [chapterId]: 'error' }));
        });
    },
    [schoolId],
  );

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
      setBoard(chaptersRes.board ?? null);
      setCurrent(activeSession(sessionsRes.sessions));
      for (const chapter of chaptersRes.chapters) {
        if (chapter.ingested && chapter.lastSessionAt) loadMap(chapter.chapterId);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, [loadMap, schoolId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Coming back from a session (ended or not) changes "continue" and the mastery figures.
  useEffect(() => navigation.addListener('focus', () => void load()), [navigation, load]);

  const allowed = access?.allowed ?? false;
  const remaining = access?.entitlement?.sessionsRemaining ?? null;

  const changeBoard = async (next: Board) => {
    if (changingBoard) return;
    setChangingBoard(next);
    try {
      await setPublicBoard(schoolId, next);
      setBoardMenuOpen(false);
      // The chapter list is that board's books: reload it rather than guess.
      await load();
      showToast(t('tutor.board.changed', { board: t(`tutor.board.${next}`) }), 'success');
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setChangingBoard(null);
    }
  };

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
      >
        {board && (
          <Pressable
            style={styles.boardChip}
            onPress={() => setBoardMenuOpen(true)}
            disabled={!isPublic}
            hitSlop={6}
            accessibilityRole={isPublic ? 'button' : 'text'}
            accessibilityLabel={t('tutor.board.label', { board: t(`tutor.board.${board}`) })}
            testID="tutor-board-chip"
          >
            <Text style={styles.boardChipText}>{t(`tutor.board.${board}`)}</Text>
            {isPublic && <FontAwesome5 name="chevron-down" size={10} color={colors.primary} />}
          </Pressable>
        )}
      </ScreenHeader>
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
                      const map = maps[chapter.chapterId];
                      return (
                        <Pressable
                          key={chapter.chapterId}
                          style={[styles.row, index === group.chapters.length - 1 && styles.rowLast, disabled && styles.rowDisabled]}
                          disabled={disabled}
                          onPress={() => {
                            setStartError(null);
                            setPicking(chapter);
                          }}
                          onLongPress={() => chapter.ingested && loadMap(chapter.chapterId)}
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
                            {chapter.ingested &&
                              (Array.isArray(map) ? (
                                <MasteryStrip points={map} onPick={setPoint} />
                              ) : map === 'loading' ? (
                                <ActivityIndicator size="small" color={colors.textMuted} style={styles.stripLoading} />
                              ) : (
                                <Pressable
                                  style={styles.showPoints}
                                  onPress={() => loadMap(chapter.chapterId)}
                                  hitSlop={6}
                                  accessibilityRole="button"
                                  testID={`tutor-map-toggle-${chapter.chapterId}`}
                                >
                                  <Text style={styles.showPointsText}>{t(map === 'error' ? 'tutor.map.retry' : 'tutor.map.show')}</Text>
                                </Pressable>
                              ))}
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

      <Modal visible={point !== null} transparent animationType="fade" onRequestClose={() => setPoint(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPoint(null)}>
          <Pressable style={styles.sheet} onPress={() => {}} testID="tutor-point-sheet">
            {point && (
              <>
                <View style={styles.pointHead}>
                  <View style={[styles.pointDot, { backgroundColor: masteryColor(masteryLevel(point.mastery)) }]} />
                  <Text style={styles.pointState}>
                    {point.mastery === null
                      ? t('tutorParent.mastery.none')
                      : t('tutor.map.mastery', { percent: masteryPercent(point.mastery) ?? 0 })}
                  </Text>
                </View>
                <Text style={styles.sheetTitle}>{point.title}</Text>
                <Text style={styles.sheetText}>{point.description}</Text>
                {point.misconceptions.length > 0 && (
                  <Text style={styles.rowHint}>{t('tutor.map.misconceptions', { list: point.misconceptions.join(', ') })}</Text>
                )}
              </>
            )}
            <Pressable style={styles.cancel} onPress={() => setPoint(null)} accessibilityRole="button">
              <Text style={styles.cancelText}>{t('common.done')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={boardMenuOpen} transparent animationType="fade" onRequestClose={() => setBoardMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => !changingBoard && setBoardMenuOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}} testID="tutor-board-sheet">
            <Text style={styles.sheetTitle}>{t('tutor.board.pickTitle')}</Text>
            <Text style={styles.sheetText}>{t('tutor.board.pickHint')}</Text>
            {BOARDS.map((option) => (
              <Pressable
                key={option}
                style={[styles.modeButton, changingBoard && styles.rowDisabled]}
                disabled={!!changingBoard}
                onPress={() => changeBoard(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: option === board }}
                testID={`tutor-board-option-${option}`}
              >
                <View style={styles.rowText}>
                  <Text style={styles.modeTitle}>{t(`tutor.board.${option}`)}</Text>
                  <Text style={styles.rowHint}>{t(`tutor.board.${option}Hint`)}</Text>
                </View>
                {changingBoard === option ? (
                  <ActivityIndicator color={colors.primary} />
                ) : option === board ? (
                  <FontAwesome5 name="check" size={14} color={colors.primary} />
                ) : null}
              </Pressable>
            ))}
            <Pressable style={styles.cancel} onPress={() => setBoardMenuOpen(false)} disabled={!!changingBoard}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
  boardChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  boardChipText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.primary },
  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  masteryTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.primaryLight, overflow: 'hidden' },
  masteryFill: { height: 6, borderRadius: 3, backgroundColor: colors.primaryBright },
  masteryText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.textSecondary, width: 36, textAlign: 'right' },
  chevron: { fontSize: 22, color: colors.textMuted, fontFamily: fonts.headingMedium },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.xs },
  pointChip: { width: 18, height: 10, borderRadius: 3 },
  stripLoading: { alignSelf: 'flex-start', marginTop: spacing.xs },
  showPoints: { alignSelf: 'flex-start', marginTop: 2 },
  showPointsText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.primary },
  pointHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pointDot: { width: 10, height: 10, borderRadius: 5 },
  pointState: { fontFamily: fonts.label, fontSize: 12, color: colors.textSecondary },
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
