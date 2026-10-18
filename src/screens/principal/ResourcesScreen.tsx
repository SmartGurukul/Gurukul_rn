import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { getErrorMessage } from '../../api/errorMessage';
import { getSectionResources, setChapterHidden } from '../../api/resources';
import { readCachedResources, readLastOpened, writeCachedResources, writeLastOpened } from '../../api/resourcesCache';
import type { ResourceSubject, SectionResources } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SubjectBackdrop } from '../../components/SubjectBackdrop';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  connectorPath,
  currentStepIndex,
  eyebrowText,
  initialExpandedSubject,
  isDimmed,
  journeySteps,
  resourceViewer,
  stepTone,
  subjectIcon,
  subjectSummary,
  visibleResourceSubjects,
  withChapterHidden,
  type JourneyStep,
} from '../../utils/resources';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Resources'>;

const accent = accents.resources;
const THUMB = 110;
const RING = 3;
const CONNECTOR_H = 88;
const GRID = 28;

/**
 * The student Resource Hub as a learning journey: pick a subject, then walk its chapters down the
 * screen one step at a time, thumbnails alternating left and right, a dashed path between them.
 * The current step (last opened, else the first with a video) is the one bright, filled step.
 *
 * Teachers and admins see hidden chapters as dimmed steps and can hide or show one with a long
 * press. The last payload is cached per section so the journey still reads offline.
 */
export function ResourcesScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const classSection = route.params.classSection;
  const viewer = resourceViewer(session);
  const canHide = viewer !== 'student';
  const contentWidth = width - spacing.lg * 2;

  const [data, setData] = useState<SectionResources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastOpened, setLastOpened] = useState<Record<string, string | null>>({});
  const [sheetStep, setSheetStep] = useState<JourneyStep | null>(null);
  const [busyChapter, setBusyChapter] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const fresh = await getSectionResources(schoolId, classSection.id);
      setData(fresh);
      setOffline(false);
      setSelectedId((prev) => prev ?? initialExpandedSubject(visibleResourceSubjects(fresh.subjects, viewer), viewer));
      writeCachedResources(schoolId, classSection.id, fresh);
    } catch (e) {
      const cached = await readCachedResources(schoolId, classSection.id);
      if (cached) {
        setData(cached);
        setOffline(true);
        setSelectedId((prev) => prev ?? initialExpandedSubject(visibleResourceSubjects(cached.subjects, viewer), viewer));
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

  // The chapter the student last opened in the selected subject decides which step is bright.
  useEffect(() => {
    if (!selectedId || selectedId in lastOpened) return;
    let cancelled = false;
    readLastOpened(schoolId, classSection.id, selectedId).then((chapterId) => {
      if (!cancelled) setLastOpened((prev) => ({ ...prev, [selectedId]: chapterId }));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, lastOpened, schoolId, classSection.id]);

  const subject = useMemo(
    () => data?.subjects.find((s) => s.subjectId === selectedId) ?? null,
    [data, selectedId]
  );
  // Students never see a subject with nothing to study (e.g. Hindi, which has no English-medium
  // books). Teachers and admins keep seeing every subject so they can still map it.
  const visibleSubjects = useMemo(
    () => (data ? visibleResourceSubjects(data.subjects, viewer) : []),
    [data, viewer]
  );
  const steps = useMemo(() => (subject ? journeySteps(subject, viewer) : []), [subject, viewer]);
  const current = currentStepIndex(steps, subject ? (lastOpened[subject.subjectId] ?? null) : null);

  const openChapter = (step: JourneyStep) => {
    if (!subject) return;
    writeLastOpened(schoolId, classSection.id, subject.subjectId, step.chapter.chapterId);
    setLastOpened((prev) => ({ ...prev, [subject.subjectId]: step.chapter.chapterId }));
    navigation.navigate('Chapter', { classSection, subject, book: step.book, chapter: step.chapter });
  };

  const toggleHidden = async (step: JourneyStep) => {
    const id = step.chapter.syllabusChapterId;
    if (!data || !id || busyChapter) return;
    const nextHidden = !step.chapter.hidden;
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

  const renderStep = (step: JourneyStep, index: number) => {
    const tone = stepTone(step, current);
    const dim = isDimmed(tone);
    const isCurrent = tone === 'current';
    const resumed = isCurrent && subject !== null && lastOpened[subject.subjectId] === step.chapter.chapterId;
    const poster = step.chapter.video?.posterUrl ?? null;
    const label = step.chapter.hidden ? t('resources.show') : resumed ? t('resources.continue') : t('resources.startLearning');
    const onPress = () => (step.chapter.hidden ? toggleHidden(step) : openChapter(step));

    const thumbnail = (
      <View style={[styles.thumb, { borderColor: isCurrent ? accent.base : colors.border }, dim && styles.dim]}>
        {poster ? (
          <Image source={{ uri: poster }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={styles.thumbNumber}>{step.chapter.number}</Text>
            <FontAwesome5 name={subjectIcon(subject?.curriculumSubjectKey ?? null)} size={14} color={accent.base} />
          </View>
        )}
      </View>
    );
    const textBlock = (
      <View style={[styles.textBlock, step.side === 'right' && styles.textBlockRight, dim && styles.dim]}>
        <View style={[styles.eyebrowRow, step.side === 'right' && styles.rowReverse]}>
          <Text style={styles.eyebrow}>{eyebrowText(step.chapter, t)}</Text>
          {step.chapter.hidden ? (
            <View style={styles.hiddenPill}>
              <Text style={styles.hiddenPillText}>{t('resources.hiddenBadge')}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.title, step.side === 'right' && styles.titleRight]}>{step.chapter.title}</Text>
        <Pressable
          style={[styles.cta, isCurrent ? styles.ctaFilled : styles.ctaOutlined, busyChapter === step.chapter.syllabusChapterId && styles.busy]}
          onPress={onPress}
          disabled={busyChapter !== null}
          accessibilityRole="button"
        >
          <FontAwesome5 name={step.chapter.hidden ? 'eye' : 'play'} size={11} color={isCurrent ? colors.white : accent.base} />
          <Text style={[styles.ctaText, isCurrent ? styles.ctaTextFilled : styles.ctaTextOutlined]}>{label}</Text>
        </Pressable>
      </View>
    );

    return (
      <View key={step.chapter.chapterId}>
        <Pressable
          style={styles.step}
          onLongPress={canHide && step.chapter.syllabusChapterId ? () => setSheetStep(step) : undefined}
          delayLongPress={350}
        >
          {step.side === 'left' ? (
            <>
              {thumbnail}
              {textBlock}
            </>
          ) : (
            <>
              {textBlock}
              {thumbnail}
            </>
          )}
        </Pressable>
        {index < steps.length - 1 ? (
          <Svg width={contentWidth} height={CONNECTOR_H} style={styles.connector}>
            <Path
              d={connectorPath(contentWidth, CONNECTOR_H, step.side, THUMB)}
              stroke={colors.textMuted}
              strokeOpacity={0.55}
              strokeWidth={2}
              strokeDasharray="6 7"
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        ) : null}
      </View>
    );
  };

  const renderSubjectBody = (subject: ResourceSubject) => {
    if (!subject.curriculumSubjectKey) {
      return (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{t('resources.unmapped')}</Text>
          <Text style={styles.noticeText}>{t('resources.unmappedHint')}</Text>
          {viewer === 'admin' ? (
            <Pressable style={[styles.cta, styles.ctaFilled, styles.noticeCta]} onPress={() => navigation.navigate('CurriculumMapping')}>
              <Text style={[styles.ctaText, styles.ctaTextFilled]}>{t('resources.linkSubject')}</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }
    if (steps.length === 0) return <Text style={styles.empty}>{t('resources.noChapters')}</Text>;
    return (
      <View style={styles.journey}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <Pattern id="journey-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <Path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke={colors.border} strokeWidth={1} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#journey-grid)" opacity={0.45} />
        </Svg>
        {steps.map(renderStep)}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <SubjectBackdrop subjectKey={subject?.curriculumSubjectKey ?? null} />
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle={t('resources.title')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer style={styles.scroll}>
        {offline ? (
          <View style={styles.offline}>
            <Text style={styles.offlineText}>{t('resources.offline')}</Text>
          </View>
        ) : null}

        {error && !data ? (
          <View>
            <ErrorNotice message={error} />
            <Pressable
              style={[styles.cta, styles.ctaFilled, styles.retry]}
              onPress={() => {
                setLoading(true);
                load().finally(() => setLoading(false));
              }}
            >
              <Text style={[styles.ctaText, styles.ctaTextFilled]}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {loading && !data ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}

        {data && visibleSubjects.length === 0 ? <Text style={styles.empty}>{t('resources.empty')}</Text> : null}

        {data && visibleSubjects.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {visibleSubjects.map((s) => {
              const selected = s.subjectId === selectedId;
              const count = subjectSummary(s, viewer).chapters;
              return (
                <Pressable
                  key={s.subjectId}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setSelectedId(s.subjectId)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s.subjectName}</Text>
                  {count > 0 ? (
                    <Text style={[styles.chipCount, selected && styles.chipCountSelected]}>{count}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {subject?.teacherName ? (
          <Text style={styles.teacher}>{t('resources.teacher', { name: subject.teacherName })}</Text>
        ) : null}

        {subject ? renderSubjectBody(subject) : null}
      </ScreenContainer>

      <Modal visible={sheetStep !== null} transparent animationType="fade" onRequestClose={() => setSheetStep(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheetStep(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle} numberOfLines={2}>
              {sheetStep ? sheetStep.chapter.title : ''}
            </Text>
            <Pressable
              style={styles.sheetOption}
              onPress={() => {
                const step = sheetStep;
                setSheetStep(null);
                if (step) toggleHidden(step);
              }}
            >
              <FontAwesome5 name={sheetStep?.chapter.hidden ? 'eye' : 'eye-slash'} size={14} color={colors.textPrimary} />
              <Text style={styles.sheetOptionText}>{sheetStep?.chapter.hidden ? t('resources.show') : t('resources.hide')}</Text>
            </Pressable>
            <Pressable style={styles.sheetOption} onPress={() => setSheetStep(null)}>
              <Text style={styles.sheetCancel}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1, backgroundColor: 'transparent' },
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
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: accent.base, borderColor: accent.base },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chipTextSelected: { color: colors.white },
  chipCount: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  chipCountSelected: { color: 'rgba(255,255,255,0.85)' },
  teacher: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  notice: { marginTop: spacing.xl, gap: spacing.sm },
  noticeTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  noticeText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  noticeCta: { alignSelf: 'flex-start', marginTop: spacing.sm },
  journey: { marginTop: spacing.xl, paddingVertical: spacing.md, overflow: 'hidden', borderRadius: radius.lg },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: THUMB + spacing.md },
  connector: { marginVertical: 2 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: RING,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: accent.light, gap: 2 },
  thumbNumber: { fontSize: 34, fontWeight: '800', color: accent.base, lineHeight: 38 },
  dim: { opacity: 0.55 },
  textBlock: { flex: 1, alignItems: 'flex-start', gap: spacing.sm },
  textBlockRight: { alignItems: 'flex-end' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowReverse: { flexDirection: 'row-reverse' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', color: colors.textMuted },
  hiddenPill: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  hiddenPillText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 25, lineHeight: 30, fontWeight: '800', color: colors.textPrimary },
  titleRight: { textAlign: 'right' },
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
  ctaText: { fontSize: 14, fontWeight: '700' },
  ctaTextFilled: { color: colors.white },
  ctaTextOutlined: { color: accent.base },
  busy: { opacity: 0.5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(32,26,43,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  sheetTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
  sheetOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  sheetOptionText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  sheetCancel: { fontSize: 16, color: colors.textMuted },
});
