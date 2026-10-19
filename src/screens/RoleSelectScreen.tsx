import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageSwitch } from '../components/LanguageSwitch';
import { Logo } from '../components/Logo';
import { VioletHero } from '../components/VioletHero';
import { colors, radius, softShadow, spacing } from '../theme/colors';

export type RegistrationRole = 'student' | 'teacher' | 'parent';

interface Props {
  schoolName?: string;
  onBack: () => void;
  onSelectRole: (role: RegistrationRole) => void;
}

export default function RoleSelectScreen({ schoolName, onBack, onSelectRole }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const ROLES: { role: RegistrationRole; title: string; description: string }[] = [
    { role: 'student', title: t('roleSelect.student.title'), description: t('roleSelect.student.description') },
    { role: 'teacher', title: t('roleSelect.teacher.title'), description: t('roleSelect.teacher.description') },
    { role: 'parent', title: t('roleSelect.parent.title'), description: t('roleSelect.parent.description') },
  ];

  return (
    <View style={styles.root}>
      <VioletHero style={styles.hero}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={[styles.languageSwitchWrapper, { top: insets.top + spacing.xs }]}>
          <LanguageSwitch />
        </View>
        <Logo width={120} onDarkBackground />
        <Text style={styles.title}>{schoolName ?? t('roleSelect.createAccount')}</Text>
        <Text style={styles.subtitle}>{t('roleSelect.subtitle')}</Text>
      </VioletHero>

      <View style={styles.form}>
        {ROLES.map((item) => (
          <Pressable key={item.role} style={styles.roleCard} onPress={() => onSelectRole(item.role)}>
            <Text style={styles.roleTitle}>{item.title}</Text>
            <Text style={styles.roleDescription}>{item.description}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  backButton: {
    position: 'absolute',
    top: spacing.xxl,
    left: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  languageSwitchWrapper: {
    position: 'absolute',
    right: spacing.lg,
  },
  title: { color: colors.white, fontSize: 22, fontWeight: '800', paddingHorizontal: spacing.lg, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },
  form: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },
  roleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  roleTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  roleDescription: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
