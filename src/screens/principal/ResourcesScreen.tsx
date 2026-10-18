import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { getSectionResources, setChapterHidden } from '../../api/resources';
import { readCachedResources, writeCachedResources } from '../../api/resourcesCache';
import type { ResourceChapter, ResourceSubject, ResourceVideo, SectionResources } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  chapterHasVideo,
  formatDuration,
  initialExpandedSubject,
  resourceViewer,
  subjectSummary,
  textbookOpenPlan,
  topicLabel,
  visibleBooks,
  visibleChapters,
  withChapterHidden,
} from '../../utils/resources';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Resources'>;

const accent = accents.resources;

/**
 * The student Resource Hub for one class section: each subject's NCERT books, their chapters and
 * topics, the textbook PDF, and the videos published so far. Teachers and admins see the same list
 * with hidden chapters flagged and a Hide/Show toggle; students never see hidden chapters.
 *
 * The last payload is cached per section so the list still reads offline; videos and PDFs need
 * the network and simply fail to open without it.
 */
export function ResourcesScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { showToast } = useToast();
  const classSection = route.params.classSection;
  const viewer = resourceViewer(session);
  const canHide = viewer !== 'student';

  const [data, setData] = useState<SectionResources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [busyChapter, setBusyChapter] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const fresh = await getSectionResources(schoolId, classSection.id);
      setData(fresh);
      setOfflineNotice(null);
      setExpandedSubjects((prev) => {
        if (prev.size > 0) return prev;
        const first = initialExpandedSubject(fresh.subjects, viewer);
        return first ? new Set([first]) : prev;
      });
      writeCachedResources(schoolId, classSection.id, fresh);
    } catch (e) {
      const cached = await readCachedResources(schoolId, classSection.id);
      if (cached) {
        setData(cached);
        setOfflineNotice(getErrorMessage(e));
        setExpandedSubjects((prev) => {
          if (prev.size > 0) return prev;
          const first = initialExpandedSubject(cached.subjects, viewer);
          return first ? new Set([first]) : prev;
        });
      } else {
        setError(getErrorMessage(e));
      }
    }
  }, [schoolId, classSection.id, viewer]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const watch = (video: ResourceVideo, title: string) => {
    navigation.navigate('VideoPlayer', { url: video.url, title, posterUrl: video.posterUrl });
  };

  const openTextbook = (chapter: ResourceChapter) => {
    const plan = textbookOpenPlan(chapter.pdfUrl, Platform.OS);
    if (!plan) return;
    if (plan.kind === 'webview') {
      navigation.navigate('WebDocument', { url: plan.url, title: chapter.title });
      return;
    }
    Linking.openURL(plan.url).catch(() => showToast(t('resources.openFailed'), 'error'));
  };

  const toggleHidden = async (chapter: ResourceChapter) => {
    if (!data || !chapter.syllabusChapterId || busyChapter) return;
    const id = chapter.syllabusChapterId;
    const nextHidden = !chapter.hidden;
    const before = data;
    setBusyChapter(id);
    setData(withChapterHidden(data, id, nextHidden));
    try {
      await setChapterHidden(schoolId, id, nextHidden);
      writeCachedResources(schoolId, classSection.id, withChapterHidden(before, id, nextHidden));
    } catch (e) {
      setData(before);
      showToast(getErrorMessage(e) || t('resources.hideFailed'), 'error');
    } finally {
      setBusyChapter(null);
    }
  };

  const renderChapter = (chapter: ResourceChapter, subject: ResourceSubject) => {
    const open = expandedChapters.has(chapter.chapterId);
    const hasVideo = chapterHasVideo(chapter);
    const duration = formatDuration(chapter.video?.durationSec);
    return (
      <View key={chapter.chapterId} style={[styles.chapter, chapter.hidden && styles.chapterHidden]}>
        <Pressable
          style={styles.chapterRow}
          onPress={() => setExpandedChapters((prev) => toggle(prev, chapter.chapterId))}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <View style={styles.chapterNumber}>
            <Text style={styles.chapterNumberText}>{chapter.number}</Text>
          </View>
          <View style={styles.chapterText}>
            {chapter.section ? <Text style={styles.sectionLabel}>{chapter.section}</Text> : null}
            <Text style={styles.chapterTitle}>{chapter.title}</Text>
            <View style={styles.badges}>
              {hasVideo ? (
                <View style={[styles.badge, styles.badgeVideo]}>
                  <Text style={styles.badgeVideoText}>{t('resources.videoBadge')}</Text>
                </View>
              ) : null}
              {chapter.hidden ? (
                <View style={[styles.badge, styles.badgeHidden]}>
                  <Text style={styles.badgeHiddenText}>{t('resources.hiddenBadge')}</Text>
                </View>
              ) : null}
              {chapter.topics.length > 0 ? (
                <Text style={styles.topicCount}>{t('resources.topicCount', { count: chapter.topics.length })}</Text>
              ) : null}
            </View>
          </View>
          <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
        </Pressable>

        <View style={styles.actions}>
          {chapter.video ? (
            <Pressable style={[styles.action, styles.actionPrimary]} onPress={() => watch(chapter.video!, chapter.title)}>
              <Text style={styles.actionPrimaryText}>
                {t('resources.watch')}
                {duration ? ` · ${duration}` : ''}
              </Text>
            </Pressable>
          ) : null}
          {chapter.pdfUrl ? (
            <Pressable style={styles.action} onPress={() => openTextbook(chapter)}>
              <Text style={styles.actionText}>{t('resources.textbook')}</Text>
            </Pressable>
          ) : null}
          {canHide && chapter.syllabusChapterId ? (
            <Pressable
              style={[styles.action, busyChapter === chapter.syllabusChapterId && styles.disabled]}
              onPress={() => toggleHidden(chapter)}
              disabled={busyChapter !== null}
            >
              <Text style={styles.actionText}>{chapter.hidden ? t('resources.show') : t('resources.hide')}</Text>
            </Pressable>
          ) : null}
        </View>

        {open ? (
          <View style={styles.topics}>
            {chapter.topics.length === 0 ? (
              <Text style={styles.noTopics}>{t('resources.noTopics')}</Text>
            ) : (
              chapter.topics.map((topic) => (
                <View key={topic.topicId} style={styles.topicRow}>
                  <View style={styles.topicDot} />
                  <Text style={styles.topicText}>{topicLabel(topic)}</Text>
                  {topic.video ? (
                    <Pressable
                      style={styles.topicWatch}
                      onPress={() => watch(topic.video!, `${subject.subjectName}: ${topic.title}`)}
                    >
                      <Text style={styles.topicWatchText}>{t('resources.watch')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const renderSubject = (subject: ResourceSubject) => {
    const open = expandedSubjects.has(subject.subjectId);
    const books = visibleBooks(subject);
    const summary = subjectSummary(subject, viewer);
    const unmapped = !subject.curriculumSubjectKey;
    return (
      <View key={subject.subjectId} style={styles.card}>
        <Pressable
          style={styles.subjectRow}
          onPress={() => setExpandedSubjects((prev) => toggle(prev, subject.subjectId))}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <View style={styles.accentBar} />
          <View style={styles.subjectText}>
            <Text style={styles.subjectName}>{subject.subjectName}</Text>
            <Text style={styles.subjectMeta}>
              {subject.teacherName ? t('resources.teacher', { name: subject.teacherName }) + ' · ' : ''}
              {unmapped
                ? t('resources.unmapped')
                : t('resources.summary', { chapters: summary.chapters, videos: summary.videos })}
            </Text>
          </View>
          <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
        </Pressable>

        {open ? (
          unmapped ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{t('resources.unmappedHint')}</Text>
              {viewer === 'admin' ? (
                <Pressable style={[styles.action, styles.actionPrimary]} onPress={() => navigation.navigate('CurriculumMapping')}>
                  <Text style={styles.actionPrimaryText}>{t('resources.linkSubject')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : books.length === 0 ? (
            <Text style={styles.noticeText}>{t('resources.noChapters')}</Text>
          ) : (
            books.map((book) => (
              <View key={book.bookCode} style={styles.book}>
                {books.length > 1 ? <Text style={styles.bookTitle}>{book.bookTitle}</Text> : null}
                {visibleChapters(book, viewer).map((chapter) => renderChapter(chapter, subject))}
              </View>
            ))
          )
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle={t('resources.title')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {offlineNotice ? (
          <View style={styles.offline}>
            <Text style={styles.offlineText}>{t('resources.offline')}</Text>
          </View>
        ) : null}

        {error && !data ? (
          <View>
            <ErrorNotice message={error} />
            <Pressable
              style={[styles.action, styles.actionPrimary, styles.retry]}
              onPress={() => {
                setLoading(true);
                load().finally(() => setLoading(false));
              }}
            >
              <Text style={styles.actionPrimaryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {loading && !data ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}

        {data && data.subjects.length === 0 ? <Text style={styles.empty}>{t('resources.empty')}</Text> : null}
        {data ? data.subjects.map(renderSubject) : null}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: 40 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  retry: { alignSelf: 'flex-start', marginTop: spacing.sm },
  offline: {
    backgroundColor: accents.reportCard.light,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  offlineText: { color: colors.warning, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...softShadow,
  },
  subjectRow: { flexDirection: 'row', alignItems: 'center' },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    backgroundColor: accent.base,
    marginRight: spacing.md,
  },
  subjectText: { flex: 1 },
  subjectName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  subjectMeta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  chevron: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  notice: { marginTop: spacing.md, gap: spacing.sm },
  noticeText: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 19 },
  book: { marginTop: spacing.md },
  bookTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  chapter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm + 2,
  },
  chapterHidden: { opacity: 0.6 },
  chapterRow: { flexDirection: 'row', alignItems: 'flex-start' },
  chapterNumber: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: accent.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  chapterNumberText: { fontSize: 13, fontWeight: '700', color: accent.base },
  chapterText: { flex: 1 },
  sectionLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  chapterTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, lineHeight: 20 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  badgeVideo: { backgroundColor: accent.light },
  badgeVideoText: { fontSize: 11, fontWeight: '700', color: accent.base },
  badgeHidden: { backgroundColor: colors.surfaceMuted },
  badgeHiddenText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  topicCount: { fontSize: 12, color: colors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, marginLeft: 28 + spacing.md },
  action: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  actionPrimary: { backgroundColor: accent.base, borderColor: accent.base },
  actionPrimaryText: { fontSize: 13, fontWeight: '700', color: colors.white },
  disabled: { opacity: 0.5 },
  topics: { marginTop: spacing.sm, marginLeft: 28 + spacing.md, gap: 6 },
  noTopics: { fontSize: 13, color: colors.textMuted },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topicDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: accent.base },
  topicText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  topicWatch: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3, backgroundColor: accent.light },
  topicWatchText: { fontSize: 12, fontWeight: '700', color: accent.base },
});
