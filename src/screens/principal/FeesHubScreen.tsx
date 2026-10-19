import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getDayBook, getFundSummary } from '../../api/ledger';
import { HeroCard, type HeroStat } from '../../components/HeroCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';
import { compactInr } from '../../utils/homeSummary';
import { todayIso } from '../../utils/timetable';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeesHub'>;

const HERO_OVERLAP = 52;

/** Money received this month and today (from the ledger), then the fee screens as a list. */
export function FeesHubScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [today, setToday] = useState<number | null | undefined>(null);
  const [month, setMonth] = useState<{ inflow: number; entries: number } | null | undefined>(null);

  useEffect(() => {
    const load = () => {
      const date = todayIso();
      getDayBook(schoolId, date)
        .then((book) => setToday(book.totalInflow))
        .catch(() => setToday(undefined));
      getFundSummary(schoolId, { from: `${date.slice(0, 7)}-01`, to: date })
        .then((summary) => setMonth({ inflow: summary.totalInflow, entries: summary.entryCount }))
        .catch(() => setMonth(undefined));
    };
    load();
    return navigation.addListener('focus', load);
  }, [schoolId, navigation]);

  const stats: HeroStat[] = [
    { label: t('fees.hub.today'), value: today === null ? null : today === undefined ? undefined : compactInr(today) },
    { label: t('fees.hub.thisMonth'), value: month === null ? null : month === undefined ? undefined : compactInr(month.inflow) },
    {
      label: t('fees.hub.entries'),
      value: month === null ? null : month === undefined ? undefined : String(month.entries),
      hint: t('fees.hub.entriesHint'),
    },
  ];

  const items: { route: keyof PrincipalStackParamList; icon: string; title: string; description: string }[] = [
    { route: 'FeeAssessmentsList', icon: 'file-invoice', title: t('fees.hub.assessments.title'), description: t('fees.hub.assessments.description') },
    { route: 'Ledger', icon: 'book', title: t('fees.hub.ledger.title'), description: t('fees.hub.ledger.description') },
    { route: 'FeeStructuresList', icon: 'layer-group', title: t('fees.hub.structures.title'), description: t('fees.hub.structures.description') },
    { route: 'FeeCategoriesList', icon: 'tags', title: t('fees.hub.categories.title'), description: t('fees.hub.categories.description') },
    { route: 'FeePaymentSettings', icon: 'qrcode', title: t('fees.hub.paymentSettings.title'), description: t('fees.hub.paymentSettings.description') },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('fees.hub.title')} subtitle={t('fees.hub.subtitle')} onBack={() => navigation.goBack()} overlap={HERO_OVERLAP} />
      <ScreenContainer>
        <HeroCard stats={stats} overlap={HERO_OVERLAP} />
        <View style={styles.listCard}>
          {items.map((item, index) => (
            <Pressable
              key={item.route}
              style={[styles.row, index === items.length - 1 && styles.rowLast]}
              onPress={() => navigation.navigate(item.route as never)}
              accessibilityRole="button"
            >
              <View style={styles.icon}>
                <FontAwesome5 name={item.icon} size={16} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  listCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.textPrimary },
  rowDescription: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
});
