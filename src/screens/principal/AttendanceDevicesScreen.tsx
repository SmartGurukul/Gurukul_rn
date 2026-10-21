import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  createAttendanceDevice,
  listAttendanceDevices,
  rotateAttendanceDeviceKey,
  updateAttendanceDevice,
} from '../../api/attendanceDevices';
import type { AttendanceDevice, AttendanceDeviceKey, AttendanceMethod } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AttendanceDevices'>;

const DEVICE_TYPES: AttendanceMethod[] = ['RFID', 'FINGERPRINT', 'FACE'];

const accent = accents.attendanceDevices;

function methodLabel(method: AttendanceMethod, t: (key: string) => string) {
  return t(`attendanceDevices.method.${method}`);
}

export function AttendanceDevicesScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();

  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [deviceType, setDeviceType] = useState<AttendanceMethod>('RFID');
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<AttendanceDeviceKey | null>(null);

  const load = useCallback(() => {
    return listAttendanceDevices(schoolId)
      .then(setDevices)
      .catch((e) => showToast(getErrorMessage(e), 'error'));
  }, [schoolId, showToast]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast(t('attendanceDevices.errors.name'), 'error');
      return;
    }
    setCreating(true);
    try {
      const created = await createAttendanceDevice(schoolId, name.trim(), deviceType);
      setShowCreate(false);
      setName('');
      setDeviceType('RFID');
      setRevealedKey(created);
      await load();
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (device: AttendanceDevice) => {
    try {
      await updateAttendanceDevice(schoolId, device.id, device.name, !device.active);
      await load();
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    }
  };

  const handleRotateKey = (device: AttendanceDevice) => {
    Alert.alert(
      t('attendanceDevices.rotateConfirmTitle'),
      t('attendanceDevices.rotateConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('attendanceDevices.rotateConfirmAction'),
          style: 'destructive',
          onPress: async () => {
            try {
              const rotated = await rotateAttendanceDeviceKey(schoolId, device.id);
              setRevealedKey(rotated);
            } catch (e) {
              showToast(getErrorMessage(e), 'error');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('attendanceDevices.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.intro}>{t('attendanceDevices.intro')}</Text>

        {showCreate ? (
          <View style={styles.createForm}>
            <LabeledInput
              label={t('attendanceDevices.name')}
              required
              value={name}
              onChangeText={setName}
              placeholder={t('attendanceDevices.namePlaceholder')}
            />
            <Text style={styles.fieldLabel}>{t('attendanceDevices.deviceType')}</Text>
            <View style={styles.typeRow}>
              {DEVICE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.typeChip, deviceType === type && { backgroundColor: accent.base }]}
                  onPress={() => setDeviceType(type)}
                >
                  <Text style={[styles.typeChipText, deviceType === type && styles.typeChipTextActive]}>
                    {methodLabel(type, t)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.addButton} onPress={handleCreate} disabled={creating}>
              <Text style={styles.addButtonText}>
                {creating ? t('common.creating') : t('attendanceDevices.createButton')}
              </Text>
            </Pressable>
            <Pressable onPress={() => setShowCreate(false)}>
              <Text style={styles.cancel}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addButton} onPress={() => setShowCreate(true)}>
            <Text style={styles.addButtonText}>{t('attendanceDevices.addButton')}</Text>
          </Pressable>
        )}

        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={devices}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('attendanceDevices.empty')}</Text> : null}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowName}>{item.name}</Text>
                <View style={[styles.typeChip, { backgroundColor: accent.light }]}>
                  <Text style={[styles.typeChipText, { color: accent.base }]}>{methodLabel(item.deviceType, t)}</Text>
                </View>
              </View>
              <Text style={styles.rowMeta}>
                {item.active ? t('attendanceDevices.active') : t('attendanceDevices.inactive')}
                {item.lastSeenAt ? ` · ${t('attendanceDevices.lastSeen')}: ${new Date(item.lastSeenAt).toLocaleString()}` : ` · ${t('attendanceDevices.neverSeen')}`}
              </Text>
              <View style={styles.rowActions}>
                <Pressable style={styles.actionButton} onPress={() => handleToggleActive(item)}>
                  <Text style={styles.actionButtonText}>
                    {item.active ? t('attendanceDevices.deactivate') : t('attendanceDevices.activate')}
                  </Text>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => handleRotateKey(item)}>
                  <Text style={styles.actionButtonText}>{t('attendanceDevices.rotateKey')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      </View>

      <Modal visible={!!revealedKey} transparent animationType="fade" onRequestClose={() => setRevealedKey(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('attendanceDevices.keyModalTitle')}</Text>
            <Text style={styles.modalWarning}>{t('attendanceDevices.keyModalWarning')}</Text>
            <TextInput
              style={styles.keyInput}
              value={revealedKey?.apiKey ?? ''}
              editable={false}
              selectTextOnFocus
              multiline
            />
            <Pressable style={styles.addButton} onPress={() => setRevealedKey(null)}>
              <Text style={styles.addButtonText}>{t('attendanceDevices.keyModalDone')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  intro: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.sm },
  createForm: { marginTop: spacing.md, marginBottom: spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xs },
  typeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  typeChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  typeChipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  typeChipTextActive: { color: colors.white },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
  cancel: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  rowActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  actionButtonText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  modalWarning: { fontSize: 13, color: colors.error, marginBottom: spacing.md },
  keyInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
});
