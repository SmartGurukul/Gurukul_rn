import { FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { changeMyClass, listProfiles } from '../../api/auth';
import { getEmployee } from '../../api/employees';
import { getStudent } from '../../api/students';
import { getErrorMessage } from '../../api/errorMessage';
import { downloadIdCardPdf, getMyIdCards } from '../../api/idCards';
import type { IdCard } from '../../api/idCards';
import type { Employee } from '../../api/types';
import { AppVersionFooter } from '../../components/AppVersionFooter';
import { IdCardView } from '../../components/IdCardView';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { isPublicSchool, PUBLIC_CLASSES } from '../../config/publicSchool';
import { usePdfDownload } from '../../hooks/usePdfDownload';
import { useLanguage } from '../../i18n/useLanguage';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { missingLabelKey } from '../../utils/idCard';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Profile'>;

interface RowProps {
  icon: string;
  label: string;
  subtitle?: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
  last?: boolean;
}

/** One row of a grouped list: icon circle, label with an optional subtitle, value and chevron. */
function SettingsRow({ icon, label, subtitle, value, onPress, destructive, last }: RowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
        <FontAwesome5 name={icon} size={15} color={destructive ? colors.error : colors.primary} />
      </View>
      <View style={[styles.rowBody, !last && styles.rowDivider]}>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]} numberOfLines={1}>
            {label}
          </Text>
          {!!subtitle && (
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {!!value && <Text style={styles.rowValue}>{value}</Text>}
        {!destructive && <FontAwesome5 name="chevron-right" size={12} color="#C4C0CF" />}
      </View>
    </Pressable>
  );
}

/**
 * The account page: the user's ID card up top (tap to open it full size and edit its details),
 * then a short grouped list of settings and Log out - nothing else.
 */
export function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const schoolId = useSchoolId();
  const { session, logout } = useAuth();
  const { showToast } = useToast();
  const isPublic = isPublicSchool(schoolId);
  const { language, languages, setLanguage } = useLanguage();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [classMenuOpen, setClassMenuOpen] = useState(false);
  const [myClass, setMyClass] = useState<string | null>(null);
  const [changingClass, setChangingClass] = useState(false);
  const currentLanguageLabel = languages.find((l) => l.code === language)?.nativeLabel ?? language.toUpperCase();
  const [card, setCard] = useState<IdCard | null>(null);
  const [cardLoading, setCardLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [hasOtherProfiles, setHasOtherProfiles] = useState(false);
  const { busy: downloading, run: runDownload } = usePdfDownload(t('idCard.shareTitle'));

  // Reload the card on every focus, so details just edited on the ID card screen show up here.
  useFocusEffect(
    useCallback(() => {
      getMyIdCards(schoolId)
        .then((cards) => setCard(cards[0] ?? null))
        .catch(() => setCard(null))
        .finally(() => setCardLoading(false));
    }, [schoolId]),
  );

  // A teacher's payslips open from here, and need their employee record.
  useEffect(() => {
    if (session.role !== 'TEACHER') return;
    getEmployee(schoolId, session.ownerId)
      .then(setEmployee)
      .catch(() => setEmployee(null));
  }, [schoolId, session.ownerId, session.role]);

  // "Switch child" only matters when this phone number is linked to more than one profile.
  useEffect(() => {
    listProfiles(schoolId)
      .then((profiles) => setHasOtherProfiles(profiles.length > 1))
      .catch(() => setHasOtherProfiles(false));
  }, [schoolId, session.ownerId, session.ownerType]);

  // Public students pick a class at sign-up and may change it here; load the current one to show it.
  useEffect(() => {
    if (!isPublic) return;
    getStudent(schoolId, session.ownerId)
      .then((student) => setMyClass(student.className))
      .catch(() => setMyClass(null));
  }, [isPublic, schoolId, session.ownerId]);

  const changeClass = async (grade: number) => {
    setChangingClass(true);
    try {
      await changeMyClass({ grade });
      setMyClass(String(grade));
      setClassMenuOpen(false);
      showToast(t('publicLogin.classChanged', { class: grade }), 'success');
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setChangingClass(false);
    }
  };

  const openCard = () => {
    if (card) navigation.navigate('IdCard', { kind: card.ownerType, id: card.ownerId, name: card.name });
  };
  const editCard = () => {
    if (card) navigation.navigate('IdCard', { kind: card.ownerType, id: card.ownerId, name: card.name, mode: 'edit' });
  };

  const settingsRows: Omit<RowProps, 'last'>[] = [
    ...(isPublic
      ? [
          {
            icon: 'graduation-cap',
            label: t('publicLogin.changeClass'),
            subtitle: t('publicLogin.changeClassSubtitle'),
            value: myClass ? t('dashboard.classLabel', { class: myClass }) : undefined,
            onPress: () => setClassMenuOpen(true),
          },
        ]
      : []),
    {
      icon: 'globe',
      label: t('language.toggleLabel'),
      subtitle: t('profile.languageSubtitle'),
      value: currentLanguageLabel,
      onPress: () => setLanguageMenuOpen(true),
    },
    ...(employee
      ? [
          {
            icon: 'wallet',
            label: t('profile.myPayslips'),
            subtitle: t('profile.payslipsSubtitle'),
            onPress: () => navigation.navigate('SalaryHistory', { employee }),
          },
        ]
      : []),
    ...(hasOtherProfiles
      ? [
          {
            icon: 'exchange-alt',
            label: t('profile.switchProfile'),
            subtitle: t('profile.switchProfileSubtitle'),
            onPress: () => navigation.navigate('SwitchChild'),
          },
        ]
      : []),
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('common.profile')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {cardLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : card ? (
          <>
            <Pressable onPress={openCard} accessibilityRole="button" accessibilityLabel={t('idCard.open')}>
              <IdCardView card={card} />
            </Pressable>
            {card.missing.length > 0 && (
              <Pressable style={styles.missing} onPress={card.canEdit ? editCard : openCard} accessibilityRole="button">
                <View style={styles.missingDot} />
                <Text style={styles.missingText} numberOfLines={2}>
                  {t('profile.missing', { items: card.missing.map((code) => t(missingLabelKey(code))).join(', ') })}
                </Text>
                <FontAwesome5 name="chevron-right" size={12} color={colors.warning} />
              </Pressable>
            )}

            <View style={styles.actions}>
              {card.canEdit && (
                <Pressable
                  style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                  onPress={editCard}
                  accessibilityRole="button"
                >
                  <View style={styles.actionIcon}>
                    <FontAwesome5 name="pen" size={15} color={colors.primary} />
                  </View>
                  <Text style={styles.actionLabel}>{t('profile.edit')}</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                onPress={() => runDownload(() => downloadIdCardPdf(schoolId, card))}
                disabled={downloading}
                accessibilityRole="button"
              >
                <View style={styles.actionIcon}>
                  {downloading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <FontAwesome5 name="download" size={15} color={colors.primary} />
                  )}
                </View>
                <Text style={styles.actionLabel}>{t('profile.download')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          // No card for this login (or it failed to load): just who's signed in.
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{session.username.trim().charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.identityName}>{session.username}</Text>
            <Text style={styles.identityRole}>{session.role}</Text>
          </View>
        )}

        <Text style={styles.groupLabel}>{t('profile.sections.settings')}</Text>
        <View style={styles.groupShadow}>
          <View style={styles.group}>
            {settingsRows.map((row, index) => (
              <SettingsRow key={row.label} {...row} last={index === settingsRows.length - 1} />
            ))}
          </View>
        </View>

        <View style={[styles.groupShadow, styles.logoutGroup]}>
          <View style={styles.group}>
            <SettingsRow icon="sign-out-alt" label={t('common.logOut')} onPress={logout} destructive last />
          </View>
        </View>

        <AppVersionFooter onLongPress={() => navigation.navigate('PushDebug')} />
      </ScreenContainer>

      <Modal
        visible={languageMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageMenuOpen(false)}
      >
        <Pressable style={styles.languageBackdrop} onPress={() => setLanguageMenuOpen(false)}>
          <View style={[styles.languageMenu, { paddingBottom: insets.bottom + spacing.md }]}>
            {languages.map((lang) => (
              <Pressable
                key={lang.code}
                style={[styles.languageOption, lang.code === language && styles.languageOptionActive]}
                onPress={() => {
                  setLanguage(lang.code);
                  setLanguageMenuOpen(false);
                }}
              >
                <Text
                  style={[styles.languageOptionText, lang.code === language && styles.languageOptionTextActive]}
                >
                  {lang.nativeLabel}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={classMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setClassMenuOpen(false)}
      >
        <Pressable style={styles.languageBackdrop} onPress={() => setClassMenuOpen(false)}>
          <View style={[styles.languageMenu, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text style={styles.classMenuTitle}>{t('publicLogin.classPrompt')}</Text>
            <View style={styles.classMenuGrid}>
              {PUBLIC_CLASSES.map((g) => {
                const selected = myClass === String(g);
                return (
                  <Pressable
                    key={g}
                    style={[styles.classMenuChip, selected && styles.classMenuChipOn]}
                    onPress={() => changeClass(g)}
                    disabled={changingClass}
                  >
                    <Text style={[styles.classMenuChipText, selected && styles.classMenuChipTextOn]}>{g}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginVertical: spacing.xl },
  missing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFF7E6',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  missingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning },
  missingText: { flex: 1, fontSize: 13, color: colors.textPrimary },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...softShadow,
  },
  actionPressed: { opacity: 0.7 },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  groupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  // The shadow sits on an outer view: iOS drops shadows on views that clip their children.
  groupShadow: { borderRadius: radius.lg, backgroundColor: colors.surface, ...softShadow },
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md, backgroundColor: colors.surface },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowIconDestructive: { backgroundColor: '#FDE4E4' },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 64,
    paddingRight: spacing.md,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowText: { flex: 1, paddingVertical: spacing.sm },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  rowLabelDestructive: { color: colors.error },
  rowSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowValue: { fontSize: 14, color: colors.textMuted },
  logoutGroup: { marginTop: spacing.lg },
  identity: { alignItems: 'center', paddingVertical: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.white, fontSize: 28, fontWeight: '800' },
  identityName: { fontSize: 19, fontWeight: '800', color: colors.textPrimary },
  identityRole: {
    marginTop: spacing.xs,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  languageBackdrop: { flex: 1, justifyContent: 'flex-end' },
  languageMenu: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingVertical: spacing.sm,
  },
  languageOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  languageOptionActive: { backgroundColor: colors.primaryLight },
  languageOptionText: { fontSize: 15, color: colors.textPrimary },
  languageOptionTextActive: { color: colors.primary, fontWeight: '700' },
  classMenuTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  classMenuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  classMenuChip: {
    width: 56,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  classMenuChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  classMenuChipText: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  classMenuChipTextOn: { color: colors.white },
});
