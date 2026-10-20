import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { listRooms, type Room } from '../../api/rooms';
import {
  clashesFromError,
  createOverride,
  deleteOverride,
  autoAssign,
  getFreeTeachers,
  getUncoveredPeriods,
  listOverrides,
  updateOverride,
  type AutoAssignPlan,
  type FreeTeacher,
  type OverrideKind,
  type TimetableClash,
  type TimetableOverride,
  type UncoveredPeriod,
} from '../../api/timetable';
import Dropdown from '../../components/Dropdown';
import { ClashList } from '../../components/ClashList';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { RoomPicker } from '../../components/RoomPicker';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { TimetableDateBar } from '../../components/TimetableDateBar';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { useOnReturn } from '../../hooks/useOnReturn';
import { colors, radius, spacing } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  freshLists,
  groupUncoveredByPeriod,
  noRoomMeansRegular,
  overrideKindVariant,
  overrideSummary,
  overrideUpdateFromExisting,
  reloadAfterFailedWrite,
  sortFreeTeachersByMatch,
  uncoveredAction,
  uncoveredOverrideKind,
  type LoadedFor,
} from '../../utils/substitutions';
import { formatIsoDate, isIsoDate, isPastIso, todayIso } from '../../utils/timetable';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Substitutions'>;

/** A period being given to a substitute, from "Needs a substitute" or another teacher's periods. */
interface CoverTarget {
  sectionId: string;
  sectionLabel: string;
  periodNumber: number;
  subjectName: string | null;
  /** The absent teacher's subject, so free-teachers can rank whoever teaches it first. */
  subjectId?: string | null;
  /** Set when changing the substitute of a cover that already exists. */
  overrideId: string | null;
  override: TimetableOverride | null;
  /** SUBSTITUTE for a new cover; an existing change keeps its own kind (it can be an extra class). */
  kind: OverrideKind;
}

const sectionLabel = (row: { className: string; section: string }) => `${row.className} - ${row.section}`;

/**
 * Admin: cover a date's periods when teachers are away. Lists the periods of teachers marked
 * Absent or Half day that nobody covers yet, lets the admin open any teacher's periods for the
 * date (leave can't be marked in advance in staff attendance, so a planned absence starts here),
 * and lists that date's changes, each of which can be undone. A substitute is picked from the
 * teachers free in that period, fewest periods that day first. Every change tells the teachers and
 * the class's students by push.
 */
export function SubstitutionsScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const today = todayIso();
  const paramDate = route.params?.date;
  const [date, setDate] = useState<string>(isIsoDate(paramDate) ? paramDate : today);
  const [uncovered, setUncovered] = useState<UncoveredPeriod[] | null>(null);
  const [overrides, setOverrides] = useState<TimetableOverride[] | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadedFor, setLoadedFor] = useState<LoadedFor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<TimetableClash[]>([]);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<CoverTarget | null>(null);
  const requestRef = useRef(0);
  const past = isPastIso(date, today);
  const dateLabel = formatIsoDate(date, i18n.language);

  const load = useCallback(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    return Promise.all([getUncoveredPeriods(schoolId, date), listOverrides(schoolId, { from: date, to: date })])
      .then(([uncoveredRows, overrideRows]) => {
        if (requestId !== requestRef.current) return;
        setUncovered(uncoveredRows);
        setOverrides(overrideRows);
        setLoadedFor({ date, teacherId: null });
        setError(null);
      })
      .catch((e) => {
        if (requestId === requestRef.current) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }, [schoolId, date]);

  useEffect(() => {
    load();
  }, [load]);

  // Covers are made when attendance is saved, on another screen: coming back here must show them.
  useEffect(() => navigation.addListener('focus', () => void load()), [navigation, load]);

  // With rooms out of use, so a change that already has one keeps showing it (pickers hide the rest).
  // A failed reload keeps the rooms already shown.
  const loadRooms = useCallback(
    () =>
      listRooms(schoolId, true)
        .then(setRooms)
        .catch(() => {}),
    [schoolId]
  );

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Back from staff attendance (someone may have just been marked absent) or from Rooms (one may
  // have just been added for the Find substitute sheet).
  useOnReturn(() => {
    load();
    loadRooms();
  });

  const refresh = () => {
    setRefreshing(true);
    Promise.all([load(), loadRooms()]).finally(() => setRefreshing(false));
  };

  const afterWrite = async () => {
    setClashes([]);
    setError(null);
    showToast(t('timetable.subs.saved'), 'success');
    await load();
  };

  /**
   * A refused change. The Undo buttons can sit far below the error box at the top, so the message
   * is also shown as a toast. When the lists are out of date (the period already has a change, or
   * the change is gone) they are reloaded first, so the change the message talks about is on show.
   */
  const writeFailed = async (e: unknown) => {
    if (reloadAfterFailedWrite(e)) await load();
    const message = getErrorMessage(e);
    setClashes(clashesFromError(e) ?? []);
    setError(message);
    showToast(message, 'error');
  };

  const periodLabel = (periodNumber: number, startTime?: string | null) =>
    startTime ? `${t('timetable.periodN', { n: periodNumber })} · ${startTime}` : t('timetable.periodN', { n: periodNumber });

  // Auto-assign: the plan the server would carry out, shown before anything is saved.
  // Keyed by the date it was computed for, so a plan from the previous date is never shown as this one's.
  const [planFor, setPlanFor] = useState<{ date: string; plan: AutoAssignPlan } | null>(null);
  const plan = planFor?.date === date ? planFor.plan : null;
  const [autoAssigning, setAutoAssigning] = useState(false);


  const confirmCancel = (sectionId: string, label: string, periodNumber: number) =>
    Alert.alert(t('timetable.subs.cancelTitle'), t('timetable.subs.cancelBody', { class: label, n: periodNumber, date: dateLabel }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('timetable.subs.cancelPeriod'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await createOverride(schoolId, { date, sectionId, periodNumber, kind: 'CANCELLED' });
            await afterWrite();
          } catch (e) {
            await writeFailed(e);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  const confirmUndo = (overrideId: string) =>
    Alert.alert(t('timetable.subs.undoTitle'), t('timetable.subs.undoBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('timetable.subs.undo'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteOverride(schoolId, overrideId);
            await afterWrite();
          } catch (e) {
            // Refused when the regular teacher or room is now busy elsewhere then.
            await writeFailed(e);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  // Only the lists loaded for the date now picked are shown: a stale row's buttons
  // would act on the new date. While the new date loads, the spinner shows instead.
  const fresh = freshLists(loadedFor, date, null);
  const uncoveredShown = fresh.day ? uncovered : null;

  /**
   * The server's plan for the day - who it would give each uncovered period to - fetched as a dry
   * run whenever the uncovered list changes, so every row can show its suggestion before anything
   * is saved. Nothing is written until the admin taps Assign all.
   */
  useEffect(() => {
    if (!uncoveredShown || uncoveredShown.length === 0 || past) return;
    let cancelled = false;
    autoAssign(schoolId, date, { dryRun: true })
      .then((next) => {
        if (!cancelled) setPlanFor({ date, plan: next });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // uncoveredShown is replaced on every reload, which is exactly when the plan goes stale.
  }, [schoolId, date, past, uncoveredShown]);

  const suggestionFor = (entry: UncoveredPeriod) =>
    plan?.items.find((i) => i.sectionId === entry.sectionId && i.periodNumber === entry.periodNumber) ?? null;

  const assignAll = async () => {
    setAutoAssigning(true);
    setError(null);
    try {
      const done = await autoAssign(schoolId, date);
      showToast(t('timetable.subs.autoAssignDone', { assigned: done.assigned, unassigned: done.unassigned }), 'success');
      await refresh();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setAutoAssigning(false);
    }
  };
  const overridesShown = fresh.day ? overrides : null;
  const locked = busy || loading;

  const coverFromUncovered = (entry: UncoveredPeriod): CoverTarget => {
    const existing = entry.overrideId ? (overridesShown?.find((o) => o.id === entry.overrideId) ?? null) : null;
    return {
      sectionId: entry.sectionId,
      sectionLabel: sectionLabel(entry),
      periodNumber: entry.periodNumber,
      subjectName: entry.subjectName,
      subjectId: entry.subjectId,
      overrideId: uncoveredAction(entry) === 'edit' ? entry.overrideId : null,
      override: existing,
      kind: existing?.kind ?? 'SUBSTITUTE',
    };
  };


  /** Change the substitute on a cover already made - the row's "Change" button. */
  const coverFromOverride = (o: TimetableOverride): CoverTarget => ({
    sectionId: o.sectionId,
    sectionLabel: sectionLabel(o),
    periodNumber: o.periodNumber,
    subjectName: o.subjectName,
    subjectId: o.subjectId ?? o.originalSubjectId ?? null,
    overrideId: o.id,
    override: o,
    kind: o.kind,
  });

  const groups = groupUncoveredByPeriod(uncoveredShown ?? []);
  const awayNames = [...new Set((uncoveredShown ?? []).map((entry) => entry.teacherName))];
  // Covers already made, kept under their period greyed out, so "period 1 is handled" is something the
  // admin can see rather than infer, and a wrong pick is one tap from undo.
  const coveredByPeriod = new Map<number, TimetableOverride[]>();
  for (const o of overridesShown ?? []) {
    if (o.kind === 'SUBSTITUTE') coveredByPeriod.set(o.periodNumber, [...(coveredByPeriod.get(o.periodNumber) ?? []), o]);
  }
  const periodRows = [...new Set([...groups.map((g) => g.periodNumber), ...coveredByPeriod.keys()])]
    .sort((a, b) => a - b)
    .map((periodNumber) => {
      const group = groups.find((g) => g.periodNumber === periodNumber) ?? null;
      const covered = coveredByPeriod.get(periodNumber) ?? [];
      return { periodNumber, group, covered, startTime: group?.startTime ?? covered[0]?.startTime ?? null, endTime: group?.endTime ?? covered[0]?.endTime ?? null };
    });

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('timetable.subs.title')} subtitle={dateLabel} onBack={() => navigation.goBack()}>
        <TimetableDateBar value={date} onChange={(value) => value && setDate(value)} minimumDate={today} onViolet />
        {uncoveredShown !== null && (
          <Text style={styles.headerSummary}>
            {uncoveredShown.length === 0
              ? t('timetable.subs.noneUncovered')
              : t('timetable.subs.summary', { away: awayNames.length, count: uncoveredShown.length })}
          </Text>
        )}
      </ScreenHeader>
      <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} keyboardShouldPersistTaps="handled">
        {past && <ErrorNotice message={t('timetable.subs.pastDate')} />}
        {error && <ErrorNotice message={error} />}
        <ClashList clashes={clashes} />
        {loading && !refreshing && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        {/* Needs a substitute */}
        <Text style={styles.sectionTitle}>{t('timetable.subs.needsCover')}</Text>
        <Text style={styles.hint}>{t('timetable.subs.leaveHint')}</Text>
        <Text style={styles.hint}>{t('timetable.subs.autoHint')}</Text>
        {date === today && (
          <Pressable onPress={() => navigation.navigate('StaffAttendance')} accessibilityRole="link">
            <Text style={styles.link}>{t('timetable.subs.markLeave')}</Text>
          </Pressable>
        )}
        {uncoveredShown !== null && periodRows.length === 0 && <Text style={styles.empty}>{t('timetable.subs.noneUncovered')}</Text>}
        {/* The plan is only fetched while something is uncovered, so once the list empties it would go stale; the
            button follows the list, not the plan. */}
        {!past && groups.length > 0 && plan && plan.assigned > 0 && (
          <View style={styles.card}>
            <ActionButton
              label={t('timetable.subs.assignNow', { count: plan.assigned })}
              primary
              disabled={locked || autoAssigning}
              onPress={assignAll}
            />
            <Text style={styles.hint}>{t('timetable.subs.assignNowHint')}</Text>
          </View>
        )}
        {periodRows.map((row) => (
          <View key={row.periodNumber} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {periodLabel(row.periodNumber, row.startTime)}
                {row.endTime ? `–${row.endTime}` : ''}
              </Text>
              {row.group ? (
                <StatusChip label={t('timetable.subs.stillToCover', { count: row.group.entries.length })} variant="neutral" />
              ) : (
                <StatusChip label={t('timetable.subs.allCovered')} variant="neutral" />
              )}
            </View>
            {(row.group?.entries ?? []).map((entry) => {
              // A change whose substitute is now away: a substitution or an extra class.
              const kind = uncoveredOverrideKind(entry, overridesShown);
              return (
                <View key={`${entry.sectionId}-${entry.periodNumber}`} style={styles.periodRow}>
                  <Text style={styles.periodTitle}>
                    {sectionLabel(entry)}
                    {entry.subjectName ? ` · ${entry.subjectName}` : ''}
                  </Text>
                  <View style={styles.chipRow}>
                    <Text style={styles.periodMeta}>{t('timetable.subs.away', { name: entry.teacherName })}</Text>
                    <StatusChip
                      label={entry.attendanceStatus === 'ABSENT' ? t('timetable.subs.absent') : t('timetable.subs.halfDay')}
                      variant="neutral"
                    />
                    {kind && <StatusChip label={t('timetable.subs.coverLost')} variant={overrideKindVariant(kind)} />}
                  </View>
                  {entry.roomName ? <Text style={styles.periodMeta}>{t('timetable.room', { name: entry.roomName })}</Text> : null}
                  {!past && (() => {
                    const suggestion = suggestionFor(entry);
                    if (!plan) return null;
                    return suggestion?.substituteTeacherName ? (
                      <Text style={styles.suggestion}>
                        {suggestion.fallback
                          ? t('timetable.subs.suggestedFallback', { name: suggestion.substituteTeacherName, subject: entry.subjectName ?? '' })
                          : `${t('timetable.subs.suggested', { name: suggestion.substituteTeacherName })}${
                              suggestion.match
                                ? ` · ${t(`timetable.subs.match.${suggestion.match}`, { subject: entry.subjectName ?? '', section: sectionLabel(entry) })}`
                                : ''
                            }`}
                      </Text>
                    ) : (
                      <Text style={[styles.periodMeta, styles.warn]}>{t('timetable.subs.noTeacherFree')}</Text>
                    );
                  })()}
                  {!past && (
                    <View style={styles.actions}>
                      <ActionButton
                        label={t('timetable.subs.findSubstitute')}
                        disabled={locked}
                        onPress={() => setTarget(coverFromUncovered(entry))}
                      />
                      {uncoveredAction(entry) === 'create' && (
                        <ActionButton
                          label={t('timetable.subs.cancelPeriod')}
                          danger
                          disabled={locked}
                          onPress={() => confirmCancel(entry.sectionId, sectionLabel(entry), entry.periodNumber)}
                        />
                      )}
                    </View>
                  )}
                </View>
              );
            })}
            {row.covered.map((o) => (
              <View key={o.id ?? `${o.sectionId}-${o.periodNumber}`} style={[styles.periodRow, styles.coveredRow]}>
                <Text style={styles.periodTitle}>
                  {sectionLabel(o)}
                  {o.subjectName ? ` · ${o.subjectName}` : ''}
                </Text>
                <View style={styles.chipRow}>
                  <Text style={styles.periodMeta}>{t('timetable.subs.coveredBy', { name: o.substituteTeacherName ?? '' })}</Text>
                  {o.autoAssigned && <StatusChip label={t('timetable.subs.autoAssignedChip')} variant="neutral" />}
                  {o.autoAssignedFallback && (
                    <StatusChip label={t('timetable.subs.fallbackChip', { subject: o.subjectName ?? '' })} variant="warning" />
                  )}
                </View>
                {!past && (
                  <View style={styles.actions}>
                    <ActionButton label={t('timetable.subs.change')} disabled={locked} onPress={() => setTarget(coverFromOverride(o))} />
                    <ActionButton label={t('timetable.subs.undo')} danger disabled={locked} onPress={() => o.id && confirmUndo(o.id)} />
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}

        {/* Changes on this day */}
        <Text style={styles.sectionTitle}>{t('timetable.subs.changes')}</Text>
        {overridesShown !== null && overridesShown.length === 0 && <Text style={styles.empty}>{t('timetable.subs.noChanges')}</Text>}
        {overridesShown?.map((o) => {
          const summary = overrideSummary(o);
          const who =
            summary.kind === 'SUBSTITUTE' ? `${summary.from ?? ''} → ${summary.to ?? ''}` : (summary.from ?? summary.to ?? '');
          return (
            <View key={o.id ?? `${o.sectionId}-${o.periodNumber}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.periodTitle}>
                  {periodLabel(o.periodNumber, o.startTime)} · {sectionLabel(o)}
                </Text>
                <StatusChip label={t(`timetable.subs.kind.${o.kind}`)} variant={overrideKindVariant(o.kind)} />
              </View>
              {!!summary.subject && <Text style={styles.periodMeta}>{summary.subject}</Text>}
              {!!who && <Text style={styles.periodMeta}>{who}</Text>}
              {!!o.roomName && <Text style={styles.periodMeta}>{t('timetable.room', { name: o.roomName })}</Text>}
              {!!o.reason && <Text style={styles.reason}>{o.reason}</Text>}
              {!past && !!o.id && (
                <View style={styles.actions}>
                  <ActionButton label={t('timetable.subs.undo')} danger disabled={locked} onPress={() => o.id && confirmUndo(o.id)} />
                </View>
              )}
            </View>
          );
        })}
      </ScreenContainer>

      {target && (
        <CoverSheet
          schoolId={schoolId}
          date={date}
          dateLabel={dateLabel}
          target={target}
          rooms={rooms}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            afterWrite();
          }}
          onStale={(e) => {
            // The period already has a change (or it is gone): close, and show the lists as they are now.
            setTarget(null);
            writeFailed(e);
          }}
          onManageRooms={() => {
            setTarget(null);
            navigation.navigate('Rooms');
          }}
        />
      )}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  danger,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  /** Destructive: plain text, no fill - the confirmation dialog carries the weight. */
  danger?: boolean;
  /** The one filled button on the screen. */
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.actionButton, danger && styles.actionDanger, primary && styles.actionPrimary, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Text style={[styles.actionText, danger && styles.actionDangerText, primary && styles.actionPrimaryText]}>{label}</Text>
    </Pressable>
  );
}

interface CoverSheetProps {
  schoolId: string;
  date: string;
  /** The date as shown, so the admin can see which day the change is for. */
  dateLabel: string;
  target: CoverTarget;
  rooms: Room[];
  onClose: () => void;
  onSaved: () => void;
  /** The save failed because the screen's lists are out of date (see reloadAfterFailedWrite). */
  onStale: (e: unknown) => void;
  onManageRooms: () => void;
}

/** "Find substitute": the teachers free in that period, a room, a reason, and Save. */
function CoverSheet({ schoolId, date, dateLabel, target, rooms, onClose, onSaved, onStale, onManageRooms }: CoverSheetProps) {
  const { t } = useTranslation();
  const sheetBottom = useBottomInset(spacing.lg);
  const [teachers, setTeachers] = useState<FreeTeacher[] | null>(null);
  // Editing a cover starts on the person who holds it, so Save with no change keeps them.
  const [selected, setSelected] = useState<string | null>(
    target.override?.kind === 'SUBSTITUTE' ? (target.override.substituteTeacherId ?? null) : null
  );
  const [roomId, setRoomId] = useState<string | null>(target.override?.roomId ?? null);
  // An auto-assigned cover's reason is the marker that makes it auto; an edit starts blank so saving makes it the admin's own.
  const [reason, setReason] = useState(target.override?.autoAssigned ? '' : (target.override?.reason ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<TimetableClash[]>([]);
  const [saving, setSaving] = useState(false);

  const loadTeachers = useCallback(() => {
    setTeachers(null);
    getFreeTeachers(schoolId, date, target.periodNumber, target.sectionId, target.subjectId, true)
      .then((rows) => setTeachers(sortFreeTeachersByMatch(rows)))
      .catch((e) => {
        setTeachers([]);
        setError(getErrorMessage(e));
      });
  }, [schoolId, date, target.periodNumber, target.sectionId, target.subjectId]);

  useEffect(loadTeachers, [loadTeachers]);

  const save = async () => {
    if (!selected) {
      setError(t('timetable.subs.pickTeacherFirst'));
      return;
    }
    setSaving(true);
    setError(null);
    setClashes([]);
    const trimmedReason = reason.trim() ? reason.trim() : null;
    try {
      if (target.overrideId) {
        const body = target.override
          ? overrideUpdateFromExisting(target.override, { substituteTeacherId: selected, roomId, reason: trimmedReason })
          : { substituteTeacherId: selected, subjectId: null, roomId, reason: trimmedReason };
        await updateOverride(schoolId, target.overrideId, body);
      } else {
        await createOverride(schoolId, {
          date,
          sectionId: target.sectionId,
          periodNumber: target.periodNumber,
          kind: 'SUBSTITUTE',
          substituteTeacherId: selected,
          roomId,
          reason: trimmedReason,
        });
      }
      onSaved();
    } catch (e) {
      if (reloadAfterFailedWrite(e)) {
        onStale(e);
        return;
      }
      const found = clashesFromError(e);
      if (found) {
        // Someone else's change got there first: show why, and who is free now.
        setClashes(found);
        setSelected(null);
        loadTeachers();
      }
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (!saving) onClose();
  };

  // Editing a cover: free-teachers leaves out whoever holds the period now - that is the substitute
  // being changed - so offer them first, pre-selected. Then the admin can keep the person and change
  // only the room or reason, and "no other X teacher is free" is a true statement rather than a wall.
  const current = target.override?.kind === 'SUBSTITUTE' && target.override.substituteTeacherId && target.override.substituteTeacherName
    ? { id: target.override.substituteTeacherId, name: target.override.substituteTeacherName }
    : null;
  const options = [
    ...(current && !(teachers ?? []).some((x) => x.teacherId === current.id)
      ? [{ value: current.id, label: `${current.name} — ${t('timetable.subs.currentSubstitute')}` }]
      : []),
    ...(teachers ?? []).map((teacher) => ({
      value: teacher.teacherId,
      label: [
        teacher.name,
        `${t(`timetable.subs.match.${teacher.match ?? 'FREE'}`, { subject: target.subjectName ?? '', section: target.sectionLabel })} · ${t('timetable.subs.periodsThatDay', { count: teacher.periodsThatDay })}${
          teacher.attendanceStatus === 'HALF_DAY' ? ` · ${t('timetable.subs.halfDay')}` : ''
        }`,
      ].join(' — '),
    })),
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.sheet, { paddingBottom: sheetBottom }]} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>{t('timetable.subs.findSubstitute')}</Text>
            <Text style={styles.sheetSubtitle}>
              {[dateLabel, target.sectionLabel, t('timetable.periodN', { n: target.periodNumber }), target.subjectName]
                .filter(Boolean)
                .join(' · ')}
            </Text>

            {teachers === null && <ActivityIndicator color={colors.primary} style={styles.loading} />}
            {teachers?.length === 0 && !error && !current && (
              <Text style={styles.empty}>{t('timetable.subs.noSubjectTeacherFree', { subject: target.subjectName ?? '' })}</Text>
            )}
            {teachers?.length === 0 && !error && current && (
              <Text style={styles.empty}>{t('timetable.subs.noOtherSubjectTeacherFree', { subject: target.subjectName ?? '' })}</Text>
            )}
            {teachers && teachers.length > 0 && target.subjectId && teachers.every((x) => !x.teachesSubject) && (
              <Text style={styles.hint}>{t('timetable.subs.fallbackPickerHint', { subject: target.subjectName ?? '' })}</Text>
            )}
            {teachers && options.length > 0 && (
              <Dropdown
                label={t('timetable.subs.substitute')}
                value={selected ?? ''}
                placeholder={t('timetable.subs.pickSubstitute')}
                required
                onSelect={setSelected}
                options={options}
              />
            )}

            <Text style={[styles.fieldLabel, styles.spaced]}>{t('timetable.editor.room')}</Text>
            <RoomPicker
              rooms={rooms}
              selectedId={roomId}
              onSelect={setRoomId}
              noneLabel={noRoomMeansRegular(target.kind) ? t('timetable.subs.sameRoom') : undefined}
              onManageRooms={onManageRooms}
            />

            <LabeledInput label={t('timetable.subs.reason')} value={reason} onChangeText={setReason} maxLength={200} />

            {error && <ErrorNotice message={error} />}
            <ClashList clashes={clashes} />

            <View style={styles.formButtons}>
              <Pressable style={styles.secondaryButton} onPress={close}>
                <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{t('timetable.subs.save')}</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginVertical: spacing.md },
  headerSummary: { fontFamily: fonts.bodySemibold, fontSize: 14, lineHeight: 20, color: colors.warning, marginTop: spacing.xs },
  sectionTitle: { fontFamily: fonts.headingMedium, fontSize: 17, lineHeight: 24, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.sm },
  link: { color: colors.primary, fontFamily: fonts.headingMedium, fontSize: 14, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 15, marginVertical: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { fontFamily: fonts.headingMedium, fontSize: 15, lineHeight: 20, color: colors.textPrimary, flexShrink: 1 },
  periodRow: { paddingTop: spacing.md, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.hairline },
  periodTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.textPrimary, flexShrink: 1 },
  periodMeta: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
  warn: { color: colors.warning },
  coveredRow: { opacity: 0.6 },
  suggestion: { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 18, color: colors.primary, marginTop: 2 },
  reason: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actionButton: {
    paddingHorizontal: spacing.lg,
    height: 40,
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  actionText: { fontFamily: fonts.headingMedium, fontSize: 13, color: colors.primary },
  actionDanger: { backgroundColor: 'transparent', paddingHorizontal: spacing.sm },
  actionDangerText: { color: colors.textSecondary },
  actionPrimary: { backgroundColor: colors.primary, height: 46, flexGrow: 1, alignItems: 'center' },
  actionPrimaryText: { color: colors.onPrimary, fontSize: 14 },
  disabled: { opacity: 0.5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(30,22,51,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24, color: colors.textPrimary },
  sheetSubtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  fieldLabel: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs },
  spaced: { marginTop: spacing.md },
  formButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  secondaryButton: { flex: 1, height: 50, justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.primaryLight, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontFamily: fonts.headingMedium, fontSize: 15 },
  primaryButton: { flex: 1, height: 50, justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontFamily: fonts.headingMedium, fontSize: 15 },
});
