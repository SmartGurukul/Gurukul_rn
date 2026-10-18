import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { setChapterHidden } from '../../api/resources';
import type { ResourceVideo } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { eyebrowText, formatDuration, resourceViewer, subjectIcon, textbookOpenPlan, topicLabel } from '../../utils/resources';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Chapter'>;

const accent = accents.resources;

/**
 * One chapter: its video (when published), the NCERT textbook, and the topics inside it as a short
 * timeline. Everything comes in by params from the journey, so there is nothing to load here.
 */
export function ChapterScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { showToast } = useToast();
  const { subject, book, chapter } = route.params;
  const canHide = resourceViewer(session) !== 'student';
  const [hidden, setHidden] = useState(chapter.hidden);
  const [busy, setBusy] = useState(false);
  const poster = chapter.video?.posterUrl ?? null;
  const duration = formatDuration(chapter.video?.durationSec);

  const watch = (video: ResourceVideo, title: string) =>
    navigation.navigate('VideoPlayer', { url: video.url, title, posterUrl: video.posterUrl });

  const openTextbook = () => {
    const plan = textbookOpenPlan(chapter.pdfUrl, Platform.OS);
    if (!plan) return;
    if (plan.kind === 'webview') {
      navigation.navigate('WebDocument', { url: plan.url, title: chapter.title });
      return;
    }
    Linking.openURL(plan.url).catch(() => showToast(t('resources.openFailed'), 'error'));
  };

  const toggleHidden = async () => {
    if (!chapter.syllabusChapterId || busy) return;
    const next = !hidden;
    setHidden(next);
    setBusy(true);
    try {
      await setChapterHidden(schoolId, chapter.syllabusChapterId, next);
    } catch (e) {
      setHidden(!next);
      showToast(getErrorMessage(e) || t('resources.hideFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={subject.subjectName} subtitle={book.bookTitle} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.hero}>
          {poster ? (
            <Image source={{ uri: poster }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroNumber}>{chapter.number}</Text>
              <FontAwesome5 name={subjectIcon(subject.curriculumSubjectKey)} size={22} color={accent.base} />
            </View>
          )}
          {chapter.video ? (
            <Pressable
              style={styles.heroPlay}
              onPress={() => watch(chapter.video!, chapter.title)}
              accessibilityRole="button"
              accessibilityLabel={t('resources.watch')}
            >
              <FontAwesome5 name="play" size={22} color={colors.white} style={styles.heroPlayIcon} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.eyebrow}>{eyebrowText(chapter, t)}</Text>
        <Text style={styles.title}>{chapter.title}</Text>
        {chapter.section ? <Text style={styles.section}>{chapter.section}</Text> : null}

        <View style={styles.actions}>
          {chapter.video ? (
            <Pressable style={[styles.cta, styles.ctaFilled]} onPress={() => watch(chapter.video!, chapter.title)}>
              <FontAwesome5 name="play" size={11} color={colors.white} />
              <Text style={[styles.ctaText, styles.ctaTextFilled]}>
                {t('resources.watch')}
                {duration ? ` · ${duration}` : ''}
              </Text>
            </Pressable>
          ) : null}
          {chapter.pdfUrl ? (
            <Pressable style={[styles.cta, styles.ctaOutlined]} onPress={openTextbook}>
              <FontAwesome5 name="book-open" size={11} color={accent.base} />
              <Text style={[styles.ctaText, styles.ctaTextOutlined]}>{t('resources.textbook')}</Text>
            </Pressable>
          ) : null}
          {canHide && chapter.syllabusChapterId ? (
            <Pressable style={[styles.cta, styles.ctaQuiet, busy && styles.busy]} onPress={toggleHidden} disabled={busy}>
              <FontAwesome5 name={hidden ? 'eye' : 'eye-slash'} size={11} color={colors.textSecondary} />
              <Text style={[styles.ctaText, styles.ctaTextQuiet]}>{hidden ? t('resources.show') : t('resources.hide')}</Text>
            </Pressable>
          ) : null}
        </View>
        {hidden ? <Text style={styles.hiddenNote}>{t('resources.hiddenBadge')}</Text> : null}
        <Text style={styles.source}>{t('resources.sourceNcert')}</Text>

        <Text style={styles.topicsHeading}>{t('resources.topics')}</Text>
        {chapter.topics.length === 0 ? (
          <Text style={styles.noTopics}>{t('resources.noTopics')}</Text>
        ) : (
          <View style={styles.timeline}>
            <View style={styles.rail} />
            {chapter.topics.map((topic) => (
              <View key={topic.topicId} style={styles.topicRow}>
                <View style={[styles.dot, topic.video && styles.dotVideo]} />
                <Text style={styles.topicText}>{topicLabel(topic)}</Text>
                {topic.video ? (
                  <Pressable style={styles.topicWatch} onPress={() => watch(topic.video!, `${chapter.title}: ${topic.title}`)}>
                    <FontAwesome5 name="play" size={9} color={accent.base} />
                    <Text style={styles.topicWatchText}>{t('resources.watch')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    aspectRatio: 16 / 9,
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: accent.light,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  heroPlaceholder: { alignItems: 'center', gap: spacing.xs },
  heroNumber: { fontSize: 56, fontWeight: '800', color: accent.base, lineHeight: 60 },
  heroPlay: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: accent.base,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  heroPlayIcon: { marginLeft: 4 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.lg },
  title: { fontSize: 26, lineHeight: 31, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.xs },
  section: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1.5,
  },
  ctaFilled: { backgroundColor: accent.base, borderColor: accent.base },
  ctaOutlined: { backgroundColor: 'transparent', borderColor: accent.base },
  ctaQuiet: { backgroundColor: 'transparent', borderColor: colors.border },
  ctaText: { fontSize: 14, fontWeight: '700' },
  ctaTextFilled: { color: colors.white },
  ctaTextOutlined: { color: accent.base },
  ctaTextQuiet: { color: colors.textSecondary },
  busy: { opacity: 0.5 },
  hiddenNote: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  source: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md },
  topicsHeading: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  noTopics: { fontSize: 13, color: colors.textMuted },
  timeline: { paddingLeft: spacing.lg, gap: spacing.md },
  rail: { position: 'absolute', left: 6, top: 6, bottom: 6, width: 2, backgroundColor: colors.border, borderRadius: 1 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { position: 'absolute', left: -spacing.lg + 2, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.textMuted },
  dotVideo: { borderColor: accent.base, backgroundColor: accent.base },
  topicText: { flex: 1, fontSize: 15, color: colors.textPrimary, lineHeight: 21 },
  topicWatch: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, backgroundColor: accent.light },
  topicWatchText: { fontSize: 12, fontWeight: '700', color: accent.base },
});
