import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AttendanceTakeBody } from './AttendanceTakeBody';
import { SectionAttendanceHistoryBody } from './SectionAttendanceHistoryScreen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AttendanceTake'>;
type Tab = 'take' | 'history';

export function SectionAttendanceScreen({ route, navigation }: Props) {
  const classSection = route.params.classSection;
  const [tab, setTab] = useState<Tab>('take');

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle="Attendance"
        onBack={() => navigation.goBack()}
        overlap={tab === 'take' ? HERO_OVERLAP : 0}
      >
        <View style={styles.tabRow}>
          <Pressable style={[styles.tab, tab === 'take' && styles.tabActive]} onPress={() => setTab('take')} accessibilityRole="tab" accessibilityState={{ selected: tab === 'take' }}>
            <Text style={[styles.tabText, tab === 'take' && styles.tabTextActive]}>Take attendance</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === 'history' && styles.tabActive]} onPress={() => setTab('history')} accessibilityRole="tab" accessibilityState={{ selected: tab === 'history' }}>
            <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>History</Text>
          </Pressable>
        </View>
      </ScreenHeader>

      {tab === 'take' ? (
        <AttendanceTakeBody classSection={classSection} overlap={HERO_OVERLAP} />
      ) : (
        <SectionAttendanceHistoryBody
          classSection={classSection}
          onSelectStudent={(student) => navigation.navigate('AttendanceHistory', { student })}
        />
      )}
    </View>
  );
}

const HERO_OVERLAP = 44;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.lg,
    padding: 4,
    marginTop: spacing.xs,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white },
  tabText: { fontFamily: fonts.headingMedium, fontSize: 13, lineHeight: 18, color: colors.onPrimary },
  tabTextActive: { color: colors.primary },
});
