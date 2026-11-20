import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '../../api/errorMessage';
import { getSchool, updateSchool } from '../../api/schools';
import type { Board, School } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SchoolBoardSettings'>;

const BOARDS: Board[] = ['CBSE', 'ICSE'];

/**
 * Admin-only: the board the school follows (CBSE / ICSE). It picks the books the AI Tutor and the
 * Resource Hub show every student of the school (workspace specs/ai-tutor-boards). Saved through
 * the school profile update, so the rest of the profile is sent back unchanged.
 */
export function SchoolBoardSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [school, setSchool] = useState<School | null>(null);
  const [board, setBoard] = useState<Board>('CBSE');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getSchool(schoolId)
      .then((s) => {
        setSchool(s);
        setBoard(s.board ?? 'CBSE');
      })
      .catch((e) => setLoadError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    // Saving over a failed load would wipe the profile: the button stays off until it is loaded.
    if (!school || saving) return;
    setSaving(true);
    try {
      const updated = await updateSchool(schoolId, {
        name: school.name,
        address: school.address,
        city: school.city,
        state: school.state,
        pincode: school.pincode,
        contactEmail: school.contactEmail,
        contactPhone: school.contactPhone,
        principalName: school.principalName,
        directorName: school.directorName,
        bankAccountNumber: school.bankAccountNumber ?? undefined,
        bankIfsc: school.bankIfsc ?? undefined,
        bankAccountHolderName: school.bankAccountHolderName ?? undefined,
        upiVpaOverride: school.upiVpaOverride ?? undefined,
        board,
      });
      setSchool(updated);
      setBoard(updated.board ?? board);
      showToast(t('schoolBoard.saved', { board: t(`schoolBoard.options.${board}.title`) }), 'success');
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const dirty = school !== null && (school.board ?? 'CBSE') !== board;

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('schoolBoard.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <>
            {loadError && (
              <>
                <ErrorNotice message={loadError} />
                <Pressable style={styles.retry} onPress={load} accessibilityRole="button">
                  <Text style={styles.retryText}>{t('common.retry')}</Text>
                </Pressable>
              </>
            )}
            <Text style={styles.intro}>{t('schoolBoard.intro')}</Text>
            <View style={styles.options}>
              {BOARDS.map((option, index) => {
                const selected = option === board;
                return (
                  <Pressable
                    key={option}
                    style={[styles.option, index === BOARDS.length - 1 && styles.optionLast, selected && styles.optionSelected]}
                    onPress={() => setBoard(option)}
                    disabled={!school}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: !school }}
                    testID={`school-board-option-${option}`}
                  >
                    <View style={styles.optionText}>
                      <Text style={styles.optionTitle}>{t(`schoolBoard.options.${option}.title`)}</Text>
                      <Text style={styles.optionHint}>{t(`schoolBoard.options.${option}.hint`)}</Text>
                    </View>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected && <FontAwesome5 name="check" size={10} color={colors.white} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[styles.save, (!dirty || saving) && styles.saveDisabled]}
              onPress={save}
              disabled={!dirty || saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: !dirty || saving }}
              testID="school-board-save"
            >
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>{t('common.save')}</Text>}
            </Pressable>
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xxl },
  intro: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.lg },
  options: { backgroundColor: colors.surface, borderRadius: radius.xxl, overflow: 'hidden', marginBottom: spacing.lg, ...softShadow },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  optionLast: { borderBottomWidth: 0 },
  optionSelected: { backgroundColor: colors.primarySoft },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontFamily: fonts.headingMedium, fontSize: 15, color: colors.textPrimary },
  optionHint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  save: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center' },
  saveDisabled: { opacity: 0.5 },
  saveText: { fontFamily: fonts.headingMedium, fontSize: 15, color: colors.white },
  retry: { alignSelf: 'center', paddingVertical: spacing.sm, marginBottom: spacing.sm },
  retryText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.primary },
});
