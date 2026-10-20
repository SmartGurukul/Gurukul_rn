import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMyChildren } from '../api/parents';
import type { Student } from '../api/types';
import { AvatarBadge } from '../components/AvatarBadge';
import { ParentCommsTiles } from '../components/ParentCommsTiles';
import { ScreenContainer } from '../components/ScreenContainer';
import { AppVersionFooter } from '../components/AppVersionFooter';
import { NotificationPermissionPrompt } from '../components/NotificationPermissionPrompt';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { useSchoolId } from '../context/SchoolContext';
import { colors, radius, spacing } from '../theme/colors';
import { fonts } from '../theme/typography';
import type { PrincipalStackParamList } from '../types/principal';
import { getErrorMessage } from '../api/errorMessage';
import { ErrorNotice } from '../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ParentHome'>;

export function ParentHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session, logout } = useAuth();
  const [children, setChildren] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyChildren(schoolId)
      .then((rows) => {
        setChildren(rows);
        if (rows.length === 1) {
          navigation.replace('ChildDashboard', { student: rows[0] });
        }
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      getMyChildren(schoolId)
        .then(setChildren)
        .catch(() => {});
    });
    return unsubscribe;
  }, [navigation, schoolId]);

  if (error) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('parentHome.title')} subtitle={session.username} />
        <ScreenContainer>
          <ErrorNotice message={error} />
        </ScreenContainer>
      </View>
    );
  }

  if (children === null) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('parentHome.title')} subtitle={session.username} />
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('parentHome.title')} subtitle={session.username} />
      <ScreenContainer>
        <NotificationPermissionPrompt />
        <ParentCommsTiles />
        {children.length > 0 && (
          <Pressable style={styles.row} onPress={() => navigation.navigate('MyBus')}>
            <AvatarBadge name={t('parentHome.schoolBus')} accentKey="schoolBus" />
            <View style={styles.rowMain}>
              <Text style={styles.rowName}>{t('parentHome.schoolBus')}</Text>
              <Text style={styles.rowMeta}>{t('parentHome.schoolBusHint')}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
        {children.length === 0 && <Text style={styles.empty}>{t('parentHome.empty')}</Text>}
        {children.map((child) => (
          <Pressable key={child.id} style={styles.row} onPress={() => navigation.navigate('ChildDashboard', { student: child })}>
            <AvatarBadge name={child.name} accentKey="students" />
            <View style={styles.rowMain}>
              <Text style={styles.rowName}>{child.name}</Text>
              <Text style={styles.rowMeta}>
                {t('parentHome.rollAndClass', { roll: child.rollNumber, classSection: child.classSectionLabel })}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>{t('common.logOut')}</Text>
        </Pressable>
        <AppVersionFooter onLongPress={() => navigation.navigate('PushDebug')} />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontFamily: fonts.body, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  rowMain: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  rowName: { fontFamily: fonts.bodySemibold, fontSize: 16, lineHeight: 22, color: colors.textPrimary },
  rowMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
  logoutButton: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md },
  logoutText: { color: colors.error, fontFamily: fonts.headingMedium, fontSize: 14 },
});
