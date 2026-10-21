import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  liftAiPause,
  listAiDataAccess,
  listAiMisuse,
  listAiPauses,
  type AiDataAccessEntry,
  type AiMisuseEvent,
  type AiPause,
} from '../../api/aiMisuse';
import { ApiError, serverNow } from '../../api/client';
import { getErrorMessage } from '../../api/errorMessage';
import type { OwnerType } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  LOOKUP_RANGES,
  MISUSE_RANGES,
  categoryLabelKey,
  featureLabelKey,
  isMissingEndpoint,
  misuseLogView,
  outcomeLabelKey,
  pausedUntilLabel,
  rangeForDays,
  roleLabelKey,
  scopeKeyLabelKey,
  scopeSummary,
  toolFallbackLabel,
  toolLabelKey,
  verdictLabelKey,
  type AiRangeDays,
  type MisuseLogFailure,
} from '../../utils/aiGuard';
import { formatExpenseTime } from '../../utils/expenses';
import { todayIst } from '../../utils/feeBills';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AiMisuseLog'>;

type Tab = 'refused' | 'paused' | 'lookups';
const TABS: Tab[] = ['refused', 'paused', 'lookups'];

interface Person {
  ownerType: OwnerType;
  ownerId: string;
  name: string;
}

interface Failure extends MisuseLogFailure {
  message: string;
}

const PAGE_SIZE = 50;
const accent = accents.aiMisuseLog;

/**
 * The principal's view of the AI school-work guard: messages the Academic Helper and the helpdesk
 * bot refused (with who sent them), who is paused right now (and lifting a pause, which the server
 * audits), and every school-data lookup the bot made for someone. All admin-only on the server
 * too. Tapping a name narrows the refused messages and lookups to that person.
 */
export function AiMisuseLogScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const listBottom = useBottomInset();

  // Opened from an AI_MISUSE_PAUSED push or alert: "Paused now" shows who.
  const pushedPauseId = route.params?.pauseId;
  const [tab, setTab] = useState<Tab>(pushedPauseId ? 'paused' : 'refused');
  const [days, setDays] = useState<AiRangeDays>(7);
  const [person, setPerson] = useState<Person | null>(null);
  // Another such push while the log is open only changes the params (the screen is already on
  // show): switch to "Paused now" and load it again, so the new pause is there.
  const [shownPauseId, setShownPauseId] = useState(pushedPauseId);
  const [reloads, setReloads] = useState(0);
  if (pushedPauseId !== shownPauseId) {
    setShownPauseId(pushedPauseId);
    if (pushedPauseId) {
      setTab('paused');
      setReloads((n) => n + 1);
    }
  }

  const [refused, setRefused] = useState<AiMisuseEvent[]>([]);
  const [pauses, setPauses] = useState<AiPause[]>([]);
  const [lookups, setLookups] = useState<AiDataAccessEntry[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liftingId, setLiftingId] = useState<string | null>(null);
  // Set synchronously, so a double tap can't open two confirms or send two lifts.
  const liftingRef = useRef(false);
  const liftConfirmOpenRef = useRef(false);
  // Bumped on every first-page load, so an answer for an older tab, range or person is dropped.
  const generation = useRef(0);

  // Lookups go back a year; refused messages are kept for 90 days.
  const effectiveDays = tab === 'refused' && days > 90 ? 90 : days;

  const fetchPage = useCallback(
    async (pageNo: number) => {
      // "Today" by the server's clock, not by a phone whose clock is off near midnight.
      const range = rangeForDays(effectiveDays, todayIst(new Date(serverNow())));
      const owner = person ? { ownerType: person.ownerType, ownerId: person.ownerId } : {};
      if (tab === 'refused') {
        const res = await listAiMisuse(schoolId, { ...range, ...owner, page: pageNo, size: PAGE_SIZE });
        return { tab, rows: res.content, hasNext: res.hasNext } as const;
      }
      if (tab === 'lookups') {
        const res = await listAiDataAccess(schoolId, { ...range, ...owner, page: pageNo, size: PAGE_SIZE });
        return { tab, rows: res.content, hasNext: res.hasNext } as const;
      }
      return { tab, rows: await listAiPauses(schoolId, { active: true }), hasNext: false } as const;
    },
    [schoolId, tab, effectiveDays, person]
  );

  type Loaded = Awaited<ReturnType<typeof fetchPage>>;
  const apply = useCallback((loaded: Loaded, append: boolean) => {
    if (loaded.tab === 'refused') setRefused((prev) => (append ? [...prev, ...loaded.rows] : loaded.rows));
    else if (loaded.tab === 'lookups') setLookups((prev) => (append ? [...prev, ...loaded.rows] : loaded.rows));
    else setPauses(loaded.rows);
    setHasNext(loaded.hasNext);
  }, []);

  // What is on show. The rows are only shown once the first page for exactly this has arrived; a
  // failed load shows why instead (see misuseLogView), never an empty list or another filter's rows.
  const queryKey = [tab, effectiveDays, person?.ownerType ?? '', person?.ownerId ?? ''].join('|');
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const view = misuseLogView(queryKey, loadedKey, failure);
  const loading = view !== 'list';

  const loadFirstPage = useCallback(() => {
    generation.current += 1;
    const mine = generation.current;
    return fetchPage(0)
      .then((loaded) => {
        if (mine !== generation.current) return;
        apply(loaded, false);
        setPage(0);
        setLoadedKey(queryKey);
        setFailure(null);
      })
      .catch((e) => {
        if (mine !== generation.current) return;
        setFailure({ key: queryKey, unavailable: isMissingEndpoint(e), message: getErrorMessage(e) });
      });
  }, [fetchPage, apply, queryKey]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage, reloads]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadFirstPage().finally(() => setRefreshing(false));
  };

  const handleRetry = () => {
    setFailure(null);
    loadFirstPage();
  };

  const handleLoadMore = () => {
    if (!hasNext || loadingMore || loading || tab === 'paused') return;
    const mine = generation.current;
    setLoadingMore(true);
    fetchPage(page + 1)
      .then((loaded) => {
        if (mine !== generation.current) return;
        apply(loaded, true);
        setPage(page + 1);
      })
      .catch((e) => showToast(getErrorMessage(e), 'error'))
      .finally(() => setLoadingMore(false));
  };

  const displayName = (name: string | null) => name ?? t('aiMisuse.unknownPerson');

  // A lookup's scope keys in the app's language; one added after this build shows as it is.
  const scopeKeyLabel = (key: string) => {
    const labelKey = scopeKeyLabelKey(key);
    return labelKey ? t(labelKey) : key;
  };

  const roleText = (role: string, classLabel?: string | null) => {
    const key = roleLabelKey(role);
    return [key ? t(key) : role, classLabel].filter(Boolean).join(' · ');
  };

  const filterBy = (row: { ownerType: OwnerType; ownerId: string; name: string | null }, toTab?: Tab) => {
    setPerson({ ownerType: row.ownerType, ownerId: row.ownerId, name: displayName(row.name) });
    if (toTab) setTab(toTab);
  };

  const lift = (pause: AiPause) => {
    if (liftingRef.current) return;
    liftingRef.current = true;
    setLiftingId(pause.id);
    liftAiPause(schoolId, pause.id)
      .then(() => {
        setPauses((prev) => prev.filter((p) => p.id !== pause.id));
        showToast(t('aiMisuse.lifted'), 'success');
      })
      .catch((e) => {
        if (e instanceof ApiError && e.errorCode === 'AI_PAUSE_NOT_ACTIVE') {
          // It ended, or another admin lifted it, meanwhile: say so and show the list as it is now.
          showToast(getErrorMessage(e), 'info');
          loadFirstPage();
        } else {
          showToast(getErrorMessage(e), 'error');
        }
      })
      .finally(() => {
        liftingRef.current = false;
        setLiftingId(null);
      });
  };

  const confirmLift = (pause: AiPause) => {
    if (liftingRef.current || liftConfirmOpenRef.current) return;
    liftConfirmOpenRef.current = true;
    const close = () => {
      liftConfirmOpenRef.current = false;
    };
    Alert.alert(
      t('aiMisuse.liftTitle'),
      t('aiMisuse.liftBody', { name: displayName(pause.name) }),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: close },
        {
          text: t('aiMisuse.lift'),
          onPress: () => {
            close();
            lift(pause);
          },
        },
      ],
      { cancelable: true, onDismiss: close }
    );
  };

  // A person's name: tapping it shows only their rows (from the Paused tab, their refused messages).
  const nameButton = (row: { ownerType: OwnerType; ownerId: string; name: string | null }, toTab?: Tab) => (
    <Pressable onPress={() => filterBy(row, toTab)} accessibilityRole="button" hitSlop={6} style={styles.nameButton}>
      <Text style={styles.name} numberOfLines={1}>
        {displayName(row.name)}
      </Text>
    </Pressable>
  );

  const renderRefused = ({ item }: { item: AiMisuseEvent }) => {
    const featureKey = featureLabelKey(item.feature);
    return (
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          {nameButton(item)}
          <Text style={styles.time}>{formatExpenseTime(item.createdAt, i18n.language)}</Text>
        </View>
        <Text style={styles.meta}>
          {[roleText(item.role, item.classLabel), featureKey ? t(featureKey) : item.feature].join(' · ')}
        </Text>
        <View style={styles.labels}>
          <View style={styles.verdictChip}>
            <Text style={styles.verdictText}>{t(verdictLabelKey(item.verdict))}</Text>
          </View>
          <Text style={styles.category}>{t(categoryLabelKey(item.category))}</Text>
          {!item.counted ? <Text style={styles.notCounted}>{t('aiMisuse.notCounted')}</Text> : null}
        </View>
        <Text style={styles.excerpt} numberOfLines={2}>
          {item.excerpt}
        </Text>
      </View>
    );
  };

  const renderPause = ({ item }: { item: AiPause }) => {
    const lifting = liftingId === item.id;
    return (
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          {nameButton(item, 'refused')}
        </View>
        <Text style={styles.meta}>{roleText(item.role, item.classLabel)}</Text>
        <Text style={styles.pausedUntil}>
          {t('aiMisuse.pausedUntil', { time: pausedUntilLabel(item.pausedUntil, i18n.language) })}
        </Text>
        <Text style={styles.meta}>{t('aiMisuse.refusalCount', { count: item.refusalCount })}</Text>
        <Pressable
          style={[styles.liftButton, (lifting || liftingId !== null) && styles.disabled]}
          onPress={() => confirmLift(item)}
          disabled={liftingId !== null}
          accessibilityRole="button"
          // Names whose pause, so the buttons on a list of several can be told apart.
          accessibilityLabel={lifting ? t('aiMisuse.lifting') : t('aiMisuse.liftFor', { name: displayName(item.name) })}
          accessibilityState={{ disabled: liftingId !== null, busy: lifting }}
        >
          {lifting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.liftText}>{t('aiMisuse.lift')}</Text>
          )}
        </Pressable>
      </View>
    );
  };

  const renderLookup = ({ item }: { item: AiDataAccessEntry }) => {
    const toolKey = toolLabelKey(item.tool);
    const outcomeKey = outcomeLabelKey(item.outcome);
    const scope = scopeSummary(item.scope, scopeKeyLabel);
    return (
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          <Text style={styles.tool} numberOfLines={1}>
            {toolKey ? t(toolKey) : toolFallbackLabel(item.tool)}
          </Text>
          <Text style={styles.time}>{formatExpenseTime(item.createdAt, i18n.language)}</Text>
        </View>
        <View style={styles.personLine}>
          {nameButton(item)}
          <Text style={styles.meta}> · {roleText(item.role)}</Text>
        </View>
        {scope ? (
          <Text style={styles.excerpt} numberOfLines={2}>
            {scope}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {[t('aiMisuse.rows', { count: item.rowCount }), outcomeKey ? t(outcomeKey) : item.outcome].join(' · ')}
        </Text>
      </View>
    );
  };

  const ranges: readonly AiRangeDays[] = tab === 'lookups' ? LOOKUP_RANGES : MISUSE_RANGES;

  const listCommon = {
    refreshControl: <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />,
    onEndReached: handleLoadMore,
    onEndReachedThreshold: 0.5,
    ListFooterComponent: loadingMore ? <ActivityIndicator style={styles.loader} color={accent.base} /> : null,
    contentContainerStyle: [styles.listContent, { paddingBottom: listBottom }],
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('aiMisuse.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.intro}>{t('aiMisuse.intro')}</Text>

        <View style={styles.tabs}>
          {TABS.map((key) => {
            const selected = tab === key;
            return (
              <Pressable
                key={key}
                style={[styles.tab, selected && styles.tabActive]}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.tabText, selected && styles.tabTextActive]} numberOfLines={1}>
                  {t(`aiMisuse.tabs.${key}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab !== 'paused' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chipRow}>
            {ranges.map((value) => {
              const selected = effectiveDays === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.chip, selected && { backgroundColor: accent.base }]}
                  onPress={() => setDays(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{t(`aiMisuse.ranges.d${value}`)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {tab !== 'paused' ? (
          person ? (
            <Pressable
              style={styles.personChip}
              onPress={() => setPerson(null)}
              accessibilityRole="button"
              // Reads who the list is narrowed to; the hint says what tapping does.
              accessibilityLabel={t('aiMisuse.personFilter', { name: person.name })}
              accessibilityHint={t('aiMisuse.clearPersonFilter')}
            >
              <Text style={styles.personChipText} numberOfLines={1}>
                {t('aiMisuse.personFilter', { name: person.name })}
              </Text>
              <FontAwesome5 name="times" size={12} color={accent.base} />
            </Pressable>
          ) : (
            <Text style={styles.hint}>{t('aiMisuse.filterHint')}</Text>
          )
        ) : null}

        {view === 'list' && failure?.key === queryKey ? (
          // A refresh failed: the rows already loaded for this stay on show, with why.
          <ErrorNotice message={failure.message} />
        ) : null}

        {view === 'loading' ? (
          <ActivityIndicator style={styles.loader} color={accent.base} />
        ) : view === 'unavailable' ? (
          <Text style={styles.empty}>{t('aiMisuse.unavailable')}</Text>
        ) : view === 'error' ? (
          <View>
            <ErrorNotice message={failure?.message ?? t('errors.generic')} />
            <Pressable onPress={handleRetry} accessibilityRole="button" hitSlop={8} style={styles.retryButton}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : tab === 'refused' ? (
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={refused}
            keyExtractor={(item) => item.id}
            renderItem={renderRefused}
            ListEmptyComponent={<Text style={styles.empty}>{t('aiMisuse.refusedEmpty')}</Text>}
            {...listCommon}
          />
        ) : tab === 'lookups' ? (
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={lookups}
            keyExtractor={(item) => item.id}
            renderItem={renderLookup}
            ListEmptyComponent={<Text style={styles.empty}>{t('aiMisuse.lookupsEmpty')}</Text>}
            {...listCommon}
          />
        ) : (
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={pauses}
            keyExtractor={(item) => item.id}
            renderItem={renderPause}
            extraData={liftingId}
            ListEmptyComponent={<Text style={styles.empty}>{t('aiMisuse.pausedEmpty')}</Text>}
            {...listCommon}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  intro: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.sm, lineHeight: 18 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    padding: spacing.xs,
    marginBottom: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.surface, ...softShadow },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: accent.base },
  chipBar: { flexGrow: 0, marginBottom: spacing.xs },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    maxWidth: '100%',
    backgroundColor: accent.light,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  personChipText: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: accent.base },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  loader: { marginTop: spacing.lg },
  listContent: { paddingBottom: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 2,
    ...softShadow,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameButton: { flexShrink: 1 },
  name: { fontSize: 15, fontWeight: '700', color: accent.base, textDecorationLine: 'underline' },
  personLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  tool: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  time: { marginLeft: 'auto', fontSize: 12, color: colors.textMuted },
  meta: { fontSize: 12, color: colors.textMuted },
  labels: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  verdictChip: { backgroundColor: accent.light, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  verdictText: { fontSize: 12, fontWeight: '800', color: accent.base },
  category: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  notCounted: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  excerpt: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
  pausedUntil: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.xs },
  liftButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: accent.base,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  liftText: { color: colors.white, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  retryButton: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: accent.base, fontWeight: '700' },
});
