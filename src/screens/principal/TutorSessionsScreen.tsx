import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '../../api/errorMessage';
import { listTutorSessions } from '../../api/tutor';
import type { TutorSessionSummary } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';
import { sessionMinutes, sessionStatusVariant } from '../../utils/tutor';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TutorSessions'>;

/** A student's own tutoring sessions, newest first. A running one reopens; a finished one shows its transcript. */
export function TutorSessionsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const [sessions, setSessions] = useState<TutorSessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return listTutorSessions(schoolId)
      .then((res) => setSessions(res.sessions))
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId]);

  useEffect(() => {
    load();
    return navigation.addListener('focus', () => void load());
  }, [load, navigation]);

  const dateLabel = (iso: string | null) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const open = (session: TutorSessionSummary) => {
    if (session.status === 'ACTIVE') navigation.navigate('TutorSession', { sessionId: session.id });
    else navigation.navigate('TutorTranscript', { sessionId: session.id });
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('tutor.sessions.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {error ? (
          <ErrorNotice message={error} />
        ) : sessions === null ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : sessions.length === 0 ? (
          <Text style={styles.empty}>{t('tutor.sessions.empty')}</Text>
        ) : (
          <View style={styles.listBlock}>
            {sessions.map((session, index) => {
              const minutes = sessionMinutes(session);
              return (
                <Pressable
                  key={session.id}
                  style={[styles.row, index === sessions.length - 1 && styles.rowLast]}
                  onPress={() => open(session)}
                  accessibilityRole="button"
                >
                  <View style={styles.icon}>
                    <FontAwesome5 name={session.mode === 'VOICE' ? 'microphone' : 'comment-dots'} size={14} color={colors.primary} />
                  </View>
                  <View style={styles.text}>
                    <Text style={styles.title} numberOfLines={2}>
                      {session.chapterTitle}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {[session.bookTitle, dateLabel(session.startedAt), minutes !== null ? t('tutor.sessions.minutes', { count: minutes }) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {session.summary ? (
                      <Text style={styles.summary} numberOfLines={2}>
                        {session.summary}
                      </Text>
                    ) : null}
                  </View>
                  <StatusChip label={t(`tutor.status.${session.status.toLowerCase()}`)} variant={sessionStatusVariant(session.status)} />
                </Pressable>
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
  loading: { marginTop: spacing.xxl },
  empty: { fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
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
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  summary: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
});
