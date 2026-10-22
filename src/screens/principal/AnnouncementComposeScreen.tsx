import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { createAnnouncement, getAnnouncementAudiences } from '../../api/chat';
import { getErrorMessage } from '../../api/errorMessage';
import type { AnnouncementAudiences, AnnouncementScope } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useHoldWhileSaving } from '../../hooks/useHoldWhileSaving';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  NOTICE_LIMITS,
  audienceKinds,
  canSend,
  chosenAudience,
  confirmKey,
  createNoticeSendGuard,
  hasAudience,
  sectionLabel,
  showYears,
  sortGrades,
  sortSections,
  toCreateRequest,
  type NoticeAudience,
} from '../../utils/announcementCompose';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AnnouncementCompose'>;

function Chip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected, disabled && !selected && styles.chipDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/**
 * "Post a notice" (ADMIN or TEACHER, from School Events): a title and a message to the whole
 * school, one section or every section of a class. Only the audiences the server says this person
 * may post to are offered, and none is picked for them. Sending asks first, naming who is
 * notified, because a notice can't be edited or deleted; a double tap, or a tap while the
 * confirmation is open, never sends twice (and the server returns the same notice for an
 * identical retry within 10 minutes).
 */
export function AnnouncementComposeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();

  const [audiences, setAudiences] = useState<AnnouncementAudiences | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [kind, setKind] = useState<AnnouncementScope | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [className, setClassName] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Changes synchronously, so a double tap can't open two confirmations or send two notices.
  const [guard] = useState(createNoticeSendGuard);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Back stays on the form while the notice is being sent, so the answer reaches it.
  useHoldWhileSaving(sending, guard.inFlight, () => showToast(t('announcementCompose.sending'), 'info'));

  const fetchAudiences = useCallback(
    () =>
      getAnnouncementAudiences(schoolId).then(
        (loaded) => {
          if (!mountedRef.current) return;
          setAudiences(loaded);
          setLoadError(null);
        },
        (e) => {
          if (mountedRef.current) setLoadError(getErrorMessage(e));
        }
      ),
    [schoolId]
  );

  useEffect(() => {
    fetchAudiences();
  }, [fetchAudiences]);

  const retry = () => {
    setLoadError(null);
    fetchAudiences();
  };

  const kinds = useMemo(() => (audiences ? audienceKinds(audiences) : []), [audiences]);
  const sections = useMemo(() => sortSections(audiences?.sections ?? []), [audiences]);
  const grades = useMemo(() => sortGrades(audiences?.grades ?? []), [audiences]);
  const withYear = showYears(sections);

  const audience = chosenAudience(kind, sectionId, className);
  const sendable = canSend(audience, title, body);

  const kindLabel = (value: AnnouncementScope) => {
    switch (value) {
      case 'SCHOOL':
        return t('announcementCompose.audienceSchool');
      case 'CLASS':
        return t('announcementCompose.audienceClass');
      case 'GRADE':
        return t('announcementCompose.audienceGrade');
    }
  };

  const confirmMessage = (chosen: NoticeAudience) => {
    switch (confirmKey(chosen)) {
      case 'confirmSchool':
        return t('announcementCompose.confirmSchool');
      case 'confirmSection': {
        const picked = chosen.kind === 'CLASS' ? sections.find((s) => s.sectionId === chosen.sectionId) : undefined;
        return t('announcementCompose.confirmSection', { section: picked ? sectionLabel(picked, withYear) : '' });
      }
      case 'confirmGrade':
        return t('announcementCompose.confirmGrade', { className: chosen.kind === 'GRADE' ? chosen.className : '' });
    }
  };

  const send = async (chosen: NoticeAudience) => {
    setSending(true);
    setError(null);
    const result = await guard.send(() => createAnnouncement(schoolId, toCreateRequest(chosen, title, body)));
    switch (result.status) {
      case 'busy':
        return; // the send already in flight answers
      case 'sent':
        Alert.alert(t('announcementCompose.sent'));
        // The guard is clear, so the hold lets this navigation through. The form stays locked
        // (sending) while it closes, so it can't be sent again on the way out.
        if (mountedRef.current) navigation.goBack();
        return;
      case 'failed':
        // The form is kept as it is; sending it again is safe (the server returns the same notice).
        if (mountedRef.current) {
          setError(getErrorMessage(result.error));
          setSending(false);
        }
    }
  };

  const handleSend = () => {
    if (!audience || !sendable) return;
    if (!guard.openConfirm()) return; // a confirmation is already open, or the notice is being sent
    const chosen = audience;
    const close = guard.closeConfirm;
    Alert.alert(
      t('announcementCompose.confirmTitle'),
      `${confirmMessage(chosen)}\n\n${t('announcementCompose.permanentHint')}`,
      [
        { text: t('common.cancel'), style: 'cancel', onPress: close },
        {
          text: t('announcementCompose.send'),
          onPress: () => {
            close();
            void send(chosen);
          },
        },
      ],
      // Android: Back or a tap outside the dialog closes it through onDismiss.
      { cancelable: true, onDismiss: close }
    );
  };

  const pickKind = (value: AnnouncementScope) => {
    setKind(value);
    setSectionId(null);
    setClassName(null);
  };

  const renderBody = () => {
    if (!audiences) {
      if (loadError) {
        return (
          <View>
            <ErrorNotice message={`${t('announcementCompose.loadFailed')} ${loadError}`} />
            <Pressable onPress={retry} accessibilityRole="button" hitSlop={8} style={styles.retryButton}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        );
      }
      return <ActivityIndicator color={colors.primary} style={styles.loading} />;
    }

    if (!hasAudience(audiences)) {
      return <Text style={styles.empty}>{t('announcementCompose.noAudience')}</Text>;
    }

    return (
      <>
        <Text style={styles.fieldLabel}>{t('announcementCompose.audience')}</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {kinds.map((value) => (
            <Chip
              key={value}
              label={kindLabel(value)}
              selected={kind === value}
              disabled={sending}
              onPress={() => pickKind(value)}
            />
          ))}
        </View>

        {kind === 'CLASS' && (
          <>
            <Text style={styles.fieldLabel}>{t('announcementCompose.pickSection')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {sections.map((s) => (
                <Chip
                  key={s.sectionId}
                  label={sectionLabel(s, withYear)}
                  selected={sectionId === s.sectionId}
                  disabled={sending}
                  onPress={() => setSectionId(s.sectionId)}
                />
              ))}
            </View>
          </>
        )}

        {kind === 'GRADE' && (
          <>
            <Text style={styles.fieldLabel}>{t('announcementCompose.pickGrade')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {grades.map((name) => (
                <Chip
                  key={name}
                  label={name}
                  selected={className === name}
                  disabled={sending}
                  onPress={() => setClassName(name)}
                />
              ))}
            </View>
          </>
        )}

        <LabeledInput
          label={t('announcementCompose.titleLabel')}
          required
          value={title}
          onChangeText={setTitle}
          maxLength={NOTICE_LIMITS.title}
          editable={!sending}
          placeholder={t('announcementCompose.titlePlaceholder')}
        />
        <Text style={styles.counter}>
          {t('announcementCompose.counter', { count: title.length, max: NOTICE_LIMITS.title })}
        </Text>

        <LabeledInput
          label={t('announcementCompose.bodyLabel')}
          required
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={NOTICE_LIMITS.body}
          editable={!sending}
          placeholder={t('announcementCompose.bodyPlaceholder')}
          style={styles.bodyInput}
        />
        <Text style={styles.counter}>
          {t('announcementCompose.counter', { count: body.length, max: NOTICE_LIMITS.body })}
        </Text>

        <Text style={styles.hint}>{t('announcementCompose.permanentHint')}</Text>

        {error && <ErrorNotice message={error} />}

        <Pressable
          style={[styles.submit, (!sendable || sending) && styles.submitDisabled]}
          onPress={handleSend}
          disabled={!sendable || sending}
          accessibilityRole="button"
          accessibilityLabel={sending ? t('announcementCompose.sending') : t('announcementCompose.send')}
          accessibilityState={{ disabled: !sendable || sending, busy: sending }}
        >
          {sending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitText}>{t('announcementCompose.send')}</Text>
          )}
        </Pressable>
      </>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('announcementCompose.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer keyboardShouldPersistTaps="handled">{renderBody()}</ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40, lineHeight: 20 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.5 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  bodyInput: { minHeight: 140, textAlignVertical: 'top' },
  counter: { fontSize: 12, color: colors.textMuted, textAlign: 'right', marginTop: -spacing.sm, marginBottom: spacing.md },
  hint: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.md },
  retryButton: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: colors.primary, fontWeight: '700' },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    minHeight: 48,
    justifyContent: 'center',
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
