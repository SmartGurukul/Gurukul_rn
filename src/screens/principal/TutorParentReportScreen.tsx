import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { getTutorReport } from '../../api/tutor';
import type { TutorChapterMastery, TutorReport, TutorSessionSummary } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { HeroCard, type HeroStat } from '../../components/HeroCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing, tints } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  accessSummary,
  isEmptyReport,
  masteryColor,
  masteryLevel,
  masteryPercent,
  quizBars,
  shortDate,
} from '../../utils/tutorReport';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TutorParentReport'>;

const BAR_MAX_HEIGHT = 64;

/** A thin bar filled to the mastery, grey when nothing is known yet. */
function MasteryBar({ mastery }: { mastery: number | null }) {
  const level = masteryLevel(mastery);
  const percent = masteryPercent(mastery) ?? 0;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: masteryColor(level) }]} />
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/** A chapter row: title, book, mastery bar and session count; tapping opens its topics. */
function ChapterRow({ chapter, locale }: { chapter: TutorChapterMastery; locale: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const percent = masteryPercent(chapter.mastery);
  return (
    <View style={styles.chapterRow}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={styles.chapterHead}>
          <View style={styles.chapterText}>
            <Text style={styles.rowTitle}>{t('tutorParent.chapters.chapterTitle', { number: chapter.chapterNumber, title: chapter.title })}</Text>
            <Text style={styles.rowMeta}>
              {chapter.bookTitle} · {t('tutorParent.chapters.sessions', { count: chapter.sessions })}
            </Text>
          </View>
          <Text style={styles.chapterPercent}>{percent === null ? '—' : `${percent}%`}</Text>
          <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
        </View>
        <MasteryBar mastery={chapter.mastery} />
      </Pressable>
      {open && (
        <View style={styles.topics}>
          {chapter.topics.length === 0 && <Text style={styles.rowMeta}>{t('tutorParent.chapters.noTopics')}</Text>}
          {chapter.topics.map((topic) => {
            const level = masteryLevel(topic.mastery);
            return (
              <View key={topic.topicId} style={styles.topicRow}>
                <View style={[styles.dot, { backgroundColor: masteryColor(level) }]} />
                <View style={styles.topicText}>
                  <Text style={styles.topicTitle}>
                    {topic.topicNumber ? `${topic.topicNumber} ` : ''}
                    {topic.title}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {t(`tutorParent.mastery.${level}`)}
                    {topic.lastSeenAt ? ` · ${t('tutorParent.chapters.lastSeen', { date: shortDate(topic.lastSeenAt, locale) })}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function SessionRow({ session, locale, onPress }: { session: TutorSessionSummary; locale: string; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable style={styles.sessionRow} onPress={onPress} accessibilityRole="button">
      <View style={styles.sessionHead}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {session.chapterTitle}
        </Text>
        <Text style={styles.sessionDate}>{shortDate(session.startedAt, locale)}</Text>
      </View>
      <Text style={styles.rowMeta}>
        {session.bookTitle}
        {session.minutes !== null ? ` · ${t('tutorParent.minutes', { count: session.minutes })}` : ''}
        {session.status === 'ABANDONED' ? ` · ${t('tutorParent.sessions.abandoned')}` : ''}
      </Text>
      {session.summary ? (
        <Text style={styles.sessionSummary} numberOfLines={2}>
          {session.summary}
        </Text>
      ) : null}
      {session.parentNote ? (
        <Text style={styles.parentNote} numberOfLines={2}>
          {t('tutorParent.sessions.forYou')}: {session.parentNote}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** A parent's (or an admin's) view of one child's AI Tutor progress; data from GET /students/{id}/report. */
export function TutorParentReportScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { studentId, studentName } = route.params;
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const [report, setReport] = useState<TutorReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    return getTutorReport(schoolId, studentId)
      .then((r) => {
        setReport(r);
        setError(null);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId, studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const title = report?.studentName ?? studentName ?? t('tutorParent.title');
  const header = <ScreenHeader title={title} subtitle={t('tutorParent.title')} onBack={() => navigation.goBack()} />;

  if (error && !report) {
    return (
      <View style={styles.root}>
        {header}
        <ScreenContainer>
          <ErrorNotice message={error} />
          <Pressable onPress={() => { setError(null); load(); }} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </ScreenContainer>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.root}>
        {header}
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </View>
    );
  }

  const access = accessSummary(report.access);
  const accessLine =
    access.kind === 'active'
      ? [
          t('tutorParent.access.active'),
          access.sessionsRemaining !== null ? t('tutorParent.access.sessionsLeft', { count: access.sessionsRemaining }) : null,
          access.expiresAt ? t('tutorParent.access.until', { date: shortDate(access.expiresAt, locale) }) : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : t('tutorParent.access.inactive');

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />;

  if (isEmptyReport(report)) {
    return (
      <View style={styles.root}>
        {header}
        <ScreenContainer refreshControl={refreshControl}>
          {error ? <ErrorNotice message={error} /> : null}
          <View style={[styles.accessLine, access.kind === 'inactive' && styles.accessInactive]}>
            <Text style={[styles.accessText, access.kind === 'inactive' && styles.accessTextInactive]}>{accessLine}</Text>
          </View>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('tutorParent.empty.title')}</Text>
            <Text style={styles.emptyText}>{t('tutorParent.empty.text')}</Text>
          </View>
        </ScreenContainer>
      </View>
    );
  }

  const heroStats: HeroStat[] = [
    { label: t('tutorParent.hero.sessions'), value: String(report.week.sessions), hint: t('tutorParent.hero.thisWeek') },
    { label: t('tutorParent.hero.minutes'), value: String(report.week.minutes), hint: t('tutorParent.hero.thisWeek') },
    {
      label: t('tutorParent.hero.quiz'),
      value: report.week.quizScore ? `${report.week.quizScore.score}/${report.week.quizScore.total}` : undefined,
      hint: report.week.quizScore ? t('tutorParent.hero.thisWeek') : t('tutorParent.hero.noQuiz'),
    },
  ];

  const bars = quizBars(report.quizTrend);

  return (
    <View style={styles.root}>
      {header}
      <ScreenContainer refreshControl={refreshControl}>
        {error ? <ErrorNotice message={error} /> : null}
        <HeroCard stats={heroStats} tint="violet" />
        <View style={[styles.accessLine, access.kind === 'inactive' && styles.accessInactive]}>
          <Text style={[styles.accessText, access.kind === 'inactive' && styles.accessTextInactive]}>{accessLine}</Text>
        </View>

        {report.conceptsThisWeek.length > 0 && (
          <>
            <SectionTitle>{t('tutorParent.thisWeek.title')}</SectionTitle>
            <View style={styles.chips}>
              {report.conceptsThisWeek.map((concept) => (
                <View key={concept.topicId} style={styles.chip}>
                  <View style={[styles.dot, { backgroundColor: masteryColor(masteryLevel(concept.mastery)) }]} />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {concept.title}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {(report.strengths.length > 0 || report.gaps.length > 0) && (
          <View style={styles.twoCol}>
            <View style={[styles.listBlock, { backgroundColor: tints.mint.bg }]}>
              <Text style={[styles.listTitle, { color: tints.mint.fg }]}>{t('tutorParent.strengths')}</Text>
              {report.strengths.length === 0 && <Text style={styles.listEmpty}>{t('tutorParent.none')}</Text>}
              {report.strengths.map((item) => (
                <View key={item.topicId} style={styles.listItem}>
                  <Text style={styles.listItemText} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <MasteryBar mastery={item.mastery} />
                </View>
              ))}
            </View>
            <View style={[styles.listBlock, { backgroundColor: tints.marigold.bg }]}>
              <Text style={[styles.listTitle, { color: tints.marigold.fg }]}>{t('tutorParent.gaps')}</Text>
              {report.gaps.length === 0 && <Text style={styles.listEmpty}>{t('tutorParent.none')}</Text>}
              {report.gaps.map((item) => (
                <View key={item.topicId} style={styles.listItem}>
                  <Text style={styles.listItemText} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <MasteryBar mastery={item.mastery} />
                </View>
              ))}
            </View>
          </View>
        )}

        {report.nextPlan ? (
          <View style={[styles.card, { backgroundColor: tints.sky.bg }]}>
            <Text style={[styles.listTitle, { color: tints.sky.fg }]}>{t('tutorParent.nextUp')}</Text>
            <Text style={styles.bodyText}>{report.nextPlan}</Text>
          </View>
        ) : null}

        {bars.length > 0 && (
          <>
            <SectionTitle>{t('tutorParent.quizTrend.title')}</SectionTitle>
            <View style={styles.card}>
              <View style={styles.barRow}>
                {bars.map((bar) => (
                  <View key={bar.weekStart} style={styles.barCol} accessibilityLabel={`${shortDate(bar.weekStart, locale)} ${bar.label}`}>
                    <Text style={styles.barLabel}>{bar.label}</Text>
                    <View style={[styles.quizBar, { height: Math.round(bar.height * BAR_MAX_HEIGHT) }]} />
                    <Text style={styles.barWeek} numberOfLines={1}>
                      {shortDate(bar.weekStart, locale)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {report.chapters.length > 0 && (
          <>
            <SectionTitle>{t('tutorParent.chapters.title')}</SectionTitle>
            <View style={styles.card}>
              {report.chapters.map((chapter) => (
                <ChapterRow key={chapter.chapterId} chapter={chapter} locale={locale} />
              ))}
            </View>
          </>
        )}

        <SectionTitle>{t('tutorParent.sessions.title')}</SectionTitle>
        <View style={styles.card}>
          {report.recentSessions.length === 0 && <Text style={styles.listEmpty}>{t('tutorParent.sessions.empty')}</Text>}
          {report.recentSessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              locale={locale}
              onPress={() => navigation.navigate('TutorTranscript', { sessionId: session.id })}
            />
          ))}
        </View>

        {report.profileSummary ? (
          <>
            <SectionTitle>{t('tutorParent.about.title', { name: report.studentName })}</SectionTitle>
            <View style={styles.card}>
              <Text style={styles.bodyText}>{report.profileSummary}</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.totals}>
          {t('tutorParent.totals', { sessions: report.total.sessions, minutes: report.total.minutes })}
        </Text>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  retryText: { color: colors.primary, fontFamily: fonts.headingMedium, fontSize: 14 },
  accessLine: {
    marginTop: spacing.md,
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  accessInactive: { backgroundColor: colors.warningLight },
  accessText: { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 18, color: colors.success },
  accessTextInactive: { color: colors.warning },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.xl, marginTop: spacing.lg, alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 24, color: colors.textPrimary, marginBottom: spacing.xs },
  emptyText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 24, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.textPrimary, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  twoCol: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  listBlock: { flex: 1, borderRadius: radius.xl, padding: spacing.lg },
  listTitle: { fontFamily: fonts.headingMedium, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  listEmpty: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  listItem: { marginBottom: spacing.sm },
  listItemText: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, color: colors.textPrimary, marginBottom: 4 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.white, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.lg, marginTop: spacing.md },
  bodyText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textPrimary },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barLabel: { fontFamily: fonts.bodySemibold, fontSize: 11, lineHeight: 14, color: colors.textSecondary, marginBottom: 3 },
  quizBar: { width: '70%', minWidth: 10, borderRadius: 4, backgroundColor: colors.primaryBright },
  barWeek: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.textMuted, marginTop: 4 },
  chapterRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  chapterText: { flex: 1 },
  chapterPercent: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary },
  chevron: { fontSize: 18, color: colors.textMuted, marginTop: -6 },
  rowTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.textPrimary },
  rowMeta: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 1 },
  topics: { marginTop: spacing.md, gap: spacing.sm },
  topicRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  topicText: { flex: 1 },
  topicTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, color: colors.textPrimary },
  sessionRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  sessionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sessionDate: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginLeft: 'auto' },
  sessionSummary: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textPrimary, marginTop: spacing.xs },
  parentNote: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.primary, marginTop: spacing.xs },
  totals: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
