import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '../../api/errorMessage';
import { answerWeeklyTutorQuiz, getWeeklyTutorQuiz } from '../../api/tutor';
import type { TutorQuizResult, TutorQuizWeekly } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing, tints } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';
import { quizComplete } from '../../utils/tutor';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TutorQuiz'>;

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * This week's five questions on the chapter the student studied most. One question at a time;
 * the answers go up together at the end and come back as a score with a line per topic.
 */
export function TutorQuizScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [quiz, setQuiz] = useState<TutorQuizWeekly | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<TutorQuizResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getWeeklyTutorQuiz(schoolId)
      .then((q) => {
        if (!cancelled) setQuiz(q);
      })
      .catch((e) => {
        if (!cancelled) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const questions = quiz?.questions ?? [];
  const question = questions[index];
  const questionIds = questions.map((q) => q.id);
  const complete = quizComplete(questionIds, answers);
  const last = index === questions.length - 1;

  const submit = async () => {
    if (!quiz || !complete || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await answerWeeklyTutorQuiz(schoolId, {
        quizId: quiz.quizId,
        answers: questionIds.map((questionId) => ({ questionId, optionId: answers[questionId] as string })),
      });
      setResult(res);
    } catch (e) {
      setSubmitError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const scoreBlock = (score: number, total: number) => (
    <View style={[styles.hero, { backgroundColor: tints.mint.bg }]}>
      <Text style={[styles.heroLabel, { color: tints.mint.fg }]}>{t('tutor.quiz.yourScore')}</Text>
      <Text style={styles.heroValue}>{t('tutor.quiz.score', { score, total })}</Text>
      {quiz?.chapterTitle ? <Text style={[styles.heroHint, { color: tints.mint.fg }]}>{quiz.chapterTitle}</Text> : null}
    </View>
  );

  const renderBody = () => {
    if (loading) return <ActivityIndicator color={colors.primary} style={styles.loading} />;
    if (error) return <ErrorNotice message={error} />;
    if (!quiz) return null;

    if (result) {
      return (
        <>
          {scoreBlock(result.score, result.total)}
          {result.perTopic.length > 0 && (
            <View style={styles.listBlock}>
              {result.perTopic.map((topic, i) => (
                <View key={topic.topicId} style={[styles.topicRow, i === result.perTopic.length - 1 && styles.rowLast]}>
                  <Text style={styles.topicTitle} numberOfLines={2}>
                    {topic.title}
                  </Text>
                  <Text style={[styles.topicScore, topic.correct === topic.total ? styles.topicFull : null]}>
                    {t('tutor.quiz.score', { score: topic.correct, total: topic.total })}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {result.masteryUpdated && <Text style={styles.note}>{t('tutor.quiz.masteryUpdated')}</Text>}
          <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>{t('common.done')}</Text>
          </Pressable>
        </>
      );
    }

    if (quiz.answered) {
      return (
        <>
          {scoreBlock(quiz.score ?? 0, quiz.total ?? 0)}
          <Text style={styles.note}>{t('tutor.quiz.alreadyAnswered')}</Text>
        </>
      );
    }

    if (!question) {
      return <Text style={styles.empty}>{t('tutor.quiz.none')}</Text>;
    }

    return (
      <>
        <View style={[styles.hero, { backgroundColor: tints.violet.bg }]}>
          <Text style={[styles.heroLabel, { color: tints.violet.fg }]}>{quiz.chapterTitle}</Text>
          <Text style={styles.progress}>{t('tutor.quiz.progress', { current: index + 1, total: questions.length })}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(((index + 1) / questions.length) * 100)}%` }]} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.questionText}>{question.text}</Text>
          {question.options.map((option, i) => {
            const selected = answers[question.id] === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.optionKey, selected && styles.optionKeySelected]}>{OPTION_KEYS[i] ?? String(i + 1)}</Text>
                <Text style={styles.optionText}>{option.text}</Text>
              </Pressable>
            );
          })}
        </View>

        {submitError && <ErrorNotice message={submitError} />}

        <View style={styles.navRow}>
          <Pressable style={[styles.secondaryButton, index === 0 && styles.disabled]} disabled={index === 0} onPress={() => setIndex((i) => i - 1)}>
            <Text style={styles.secondaryButtonText}>{t('tutor.quiz.previous')}</Text>
          </Pressable>
          {last ? (
            <Pressable style={[styles.primaryButton, styles.navPrimary, (!complete || submitting) && styles.disabled]} disabled={!complete || submitting} onPress={submit}>
              {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{t('tutor.quiz.submit')}</Text>}
            </Pressable>
          ) : (
            <Pressable
              style={[styles.primaryButton, styles.navPrimary, !answers[question.id] && styles.disabled]}
              disabled={!answers[question.id]}
              onPress={() => setIndex((i) => i + 1)}
            >
              <Text style={styles.primaryButtonText}>{t('tutor.quiz.next')}</Text>
            </Pressable>
          )}
        </View>
      </>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('tutor.quiz.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>{renderBody()}</ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xxl },
  empty: { fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  hero: { borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.xs },
  heroLabel: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  heroValue: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, color: colors.textPrimary },
  heroHint: { fontFamily: fonts.body, fontSize: 13 },
  progress: { fontFamily: fonts.headingMedium, fontSize: 16, color: colors.textPrimary },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden', marginTop: spacing.xs },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primaryBright },
  card: { backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.lg },
  questionText: { fontFamily: fonts.bodySemibold, fontSize: 16, lineHeight: 24, color: colors.textPrimary, marginBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionKey: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.primary,
    color: colors.white,
    fontFamily: fonts.headingMedium,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
  optionKeySelected: { backgroundColor: colors.textPrimary },
  optionText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textPrimary },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  navPrimary: { flex: 1, marginTop: 0 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  primaryButtonText: { color: colors.white, fontFamily: fonts.headingMedium, fontSize: 15 },
  secondaryButton: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: 15 },
  disabled: { opacity: 0.5 },
  listBlock: { backgroundColor: colors.surface, borderRadius: radius.xxl, overflow: 'hidden', marginBottom: spacing.md },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowLast: { borderBottomWidth: 0 },
  topicTitle: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textPrimary },
  topicScore: { fontFamily: fonts.headingMedium, fontSize: 14, color: colors.textSecondary },
  topicFull: { color: colors.success },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.md },
});
