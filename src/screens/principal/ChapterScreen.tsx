import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { setChapterHidden } from '../../api/resources';
import { readLastTopic, writeLastTopic } from '../../api/resourcesCache';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  chapterTimeline,
  chapterTopicsEyebrow,
  formatDuration,
  initialTimelineIndex,
  nextPlayableIndex,
  reachedEnd,
  nodeLabel,
  nodeMarker,
  resourceViewer,
  subjectIcon,
  textbookOpenPlan,
  type TimelineNode,
} from '../../utils/resources';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Chapter'>;

const accent = accents.resources;
const MARKER = 14;

/**
 * One chapter as a timeline: the player sits at the top and plays whichever node is selected (the
 * chapter overview when the chapter has its own video, then each topic). Tapping a node with a
 * video switches the player; finishing one moves on to the next that has a video. The selected
 * node is remembered per chapter. Everything arrives by params, so nothing is fetched here.
 */
export function ChapterScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { showToast } = useToast();
  const { classSection, subject, book, chapter } = route.params;
  const canHide = resourceViewer(session) !== 'student';

  const nodes = useMemo(() => chapterTimeline(chapter, t('resources.overview')), [chapter, t]);
  const hasAnyVideo = nodes.some((node) => node.video !== null);
  const [selected, setSelected] = useState(-1);
  const selectedRef = useRef(-1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [hidden, setHidden] = useState(chapter.hidden);
  const [busy, setBusy] = useState(false);

  // One player for the screen; its source changes as nodes are tapped. Created empty because the
  // node to start on is read from storage first.
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  const play = useCallback(
    (index: number, remember: boolean) => {
      const node = nodes[index];
      if (!node?.video) return;
      selectedRef.current = index;
      setSelected(index);
      if (remember) writeLastTopic(schoolId, classSection.id, chapter.chapterId, node.key);
      player
        .replaceAsync(node.video.url)
        .then(() => player.play())
        .catch(() => showToast(t('resources.openFailed'), 'error'));
    },
    [nodes, player, schoolId, classSection.id, chapter.chapterId, showToast, t]
  );

  // Resume where the student left off, else start on the first video.
  useEffect(() => {
    let cancelled = false;
    readLastTopic(schoolId, classSection.id, chapter.chapterId).then((lastKey) => {
      if (cancelled) return;
      const start = initialTimelineIndex(nodes, lastKey);
      if (start >= 0) play(start, false);
    });
    return () => {
      cancelled = true;
    };
    // Only on first open: later selections come from taps and auto-advance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Finishing a video moves on to the next one that exists.
  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      // The first source replacing the empty player also reports an end; that is not a finished video.
      if (!reachedEnd(player.duration, player.currentTime)) return;
      const next = nextPlayableIndex(nodes, selectedRef.current);
      if (next < 0) return;
      showToast(t('resources.nextUp', { title: nodeLabel(nodes[next]) }), 'info');
      play(next, true);
    });
    return () => subscription.remove();
  }, [player, nodes, play, showToast, t]);

  // Leaving the screen, by back or by pushing another one, stops the sound.
  useEffect(() => {
    const pause = () => {
      try {
        player.pause();
      } catch {
        // Already released with the screen.
      }
    };
    const unsubscribe = navigation.addListener('blur', pause);
    return () => {
      unsubscribe();
      pause();
    };
  }, [navigation, player]);

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

  const onNodePress = (node: TimelineNode, index: number) => {
    if (node.video) {
      setExpandedKey(null);
      play(index, true);
      return;
    }
    setExpandedKey((prev) => (prev === node.key ? null : node.key));
  };

  const nowPlaying = selected >= 0 ? nodes[selected] : null;

  return (
    <View style={styles.root}>
      <ScreenHeader title={subject.subjectName} subtitle={book.bookTitle} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.stage}>
          {hasAnyVideo ? (
            <VideoView
              player={player}
              style={styles.video}
              contentFit="contain"
              nativeControls
              fullscreenOptions={{ enable: true }}
              allowsPictureInPicture={false}
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderNumber}>{chapter.number}</Text>
              <FontAwesome5 name={subjectIcon(subject.curriculumSubjectKey)} size={20} color={accent.base} />
              <Text style={styles.placeholderText}>{t('resources.noVideos')}</Text>
            </View>
          )}
        </View>

        <Text style={styles.eyebrow}>{chapterTopicsEyebrow(chapter, t)}</Text>
        <Text style={styles.title}>{chapter.title}</Text>
        {nowPlaying ? (
          <Text style={styles.nowPlaying} numberOfLines={2}>
            {t('resources.nowPlaying', { title: nodeLabel(nowPlaying) })}
          </Text>
        ) : null}

        <View style={styles.actions}>
          {chapter.pdfUrl ? (
            <Pressable style={[styles.cta, styles.ctaOutlined]} onPress={openTextbook} accessibilityRole="button">
              <FontAwesome5 name="book-open" size={11} color={accent.base} />
              <Text style={[styles.ctaText, styles.ctaTextOutlined]}>{t('resources.textbook')}</Text>
            </Pressable>
          ) : null}
          {canHide && chapter.syllabusChapterId ? (
            <Pressable style={[styles.cta, styles.ctaQuiet, busy && styles.busy]} onPress={toggleHidden} disabled={busy} accessibilityRole="button">
              <FontAwesome5 name={hidden ? 'eye' : 'eye-slash'} size={11} color={colors.textSecondary} />
              <Text style={[styles.ctaText, styles.ctaTextQuiet]}>{hidden ? t('resources.show') : t('resources.hide')}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.source}>{t('resources.sourceNcert')}</Text>
        </View>
        {hidden ? <Text style={styles.hiddenNote}>{t('resources.hiddenBadge')}</Text> : null}

        <Text style={styles.topicsHeading}>{t('resources.topics')}</Text>
        {nodes.length === 0 ? (
          <Text style={styles.noTopics}>{t('resources.noTopics')}</Text>
        ) : (
          <View style={styles.timeline}>
            <View style={styles.rail} />
            {nodes.map((node, index) => {
              const marker = nodeMarker(node, index === selected);
              const duration = formatDuration(node.video?.durationSec);
              const expanded = expandedKey === node.key;
              return (
                <View key={node.key}>
                  <Pressable
                    style={styles.node}
                    onPress={() => onNodePress(node, index)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: index === selected, expanded: node.video ? undefined : expanded }}
                  >
                    <View
                      style={[
                        styles.marker,
                        marker === 'playing' && styles.markerPlaying,
                        marker === 'available' && styles.markerAvailable,
                        marker === 'none' && styles.markerNone,
                      ]}
                    />
                    <View style={styles.nodeText}>
                      {node.number ? <Text style={styles.nodeNumber}>{node.number}</Text> : null}
                      <Text style={[styles.nodeTitle, marker === 'playing' && styles.nodeTitlePlaying, marker === 'none' && styles.nodeTitleQuiet]}>
                        {node.title}
                      </Text>
                    </View>
                    {node.video ? (
                      duration ? (
                        <Text style={[styles.duration, marker === 'playing' && styles.durationPlaying]}>{duration}</Text>
                      ) : (
                        <FontAwesome5 name="play" size={11} color={marker === 'playing' ? accent.base : colors.textMuted} />
                      )
                    ) : (
                      <Text style={styles.noVideo}>{t('resources.noVideoYet')}</Text>
                    )}
                  </Pressable>
                  {expanded && !node.video ? (
                    <View style={styles.note}>
                      <Text style={styles.noteText}>{t('resources.noVideoTopic')}</Text>
                      {chapter.pdfUrl ? (
                        <Pressable onPress={openTextbook} accessibilityRole="link">
                          <Text style={styles.noteLink}>{t('resources.openTextbook')}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  stage: {
    aspectRatio: 16 / 9,
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#000000',
    ...softShadow,
  },
  video: { flex: 1 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: accent.light, gap: spacing.xs },
  placeholderNumber: { fontSize: 56, fontWeight: '800', color: accent.base, lineHeight: 60 },
  placeholderText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.lg },
  title: { fontSize: 26, lineHeight: 31, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.xs },
  nowPlaying: { fontSize: 13, color: accent.base, fontWeight: '600', marginTop: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1.5,
  },
  ctaOutlined: { backgroundColor: 'transparent', borderColor: accent.base },
  ctaQuiet: { backgroundColor: 'transparent', borderColor: colors.border },
  ctaText: { fontSize: 14, fontWeight: '700' },
  ctaTextOutlined: { color: accent.base },
  ctaTextQuiet: { color: colors.textSecondary },
  busy: { opacity: 0.5 },
  source: { fontSize: 12, color: colors.textMuted, marginLeft: spacing.xs },
  hiddenNote: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  topicsHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  noTopics: { fontSize: 13, color: colors.textMuted },
  timeline: { paddingLeft: spacing.lg + MARKER / 2 },
  rail: { position: 'absolute', left: spacing.lg + MARKER / 2 - 1, top: 10, bottom: 10, width: 2, backgroundColor: colors.border, borderRadius: 1 },
  node: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md - 2, paddingRight: spacing.xs },
  marker: {
    position: 'absolute',
    // Centred on the rail: the row starts at the rail's centre, so the marker sits half its width to the left.
    left: -MARKER / 2,
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  markerPlaying: { backgroundColor: accent.base, borderColor: accent.base },
  markerAvailable: { borderColor: accent.base },
  markerNone: { borderColor: colors.border },
  nodeText: { flex: 1, marginLeft: MARKER / 2 + spacing.sm },
  nodeNumber: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4 },
  nodeTitle: { fontSize: 15, color: colors.textPrimary, lineHeight: 20 },
  nodeTitlePlaying: { color: accent.base, fontWeight: '700' },
  nodeTitleQuiet: { color: colors.textSecondary },
  duration: { fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  durationPlaying: { color: accent.base, fontWeight: '700' },
  noVideo: { fontSize: 11, color: colors.textMuted },
  note: {
    marginLeft: MARKER / 2 + spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  noteText: { fontSize: 13, color: colors.textSecondary },
  noteLink: { fontSize: 13, fontWeight: '700', color: accent.base },
});
