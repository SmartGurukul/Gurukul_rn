import { FontAwesome5 } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { createSubject, listSubjects } from '../api/subjects';
import type { Subject } from '../api/types';
import { useBottomInset } from '../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import LabeledInput from './LabeledInput';
import { getErrorMessage } from '../api/errorMessage';
import { ErrorNotice } from './ErrorNotice';

interface Props {
  schoolId: string;
  selectedId: string | null;
  onSelect: (subject: Subject) => void;
}

export default function SubjectPicker({ schoolId, selectedId, onSelect }: Props) {
  const sheetBottom = useBottomInset(spacing.lg);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    listSubjects(schoolId)
      .then(setSubjects)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [schoolId]);

  const selected = subjects.find((s) => s.id === selectedId) ?? null;

  const handleCreate = async () => {
    if (!code || !name) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createSubject(schoolId, { code, name });
      setSubjects((prev) => [...prev, created]);
      onSelect(created);
      setShowCreate(false);
      setCode('');
      setName('');
      setOpen(false);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <View>
      {error && !open && <ErrorNotice message={error} />}

      <Pressable style={styles.field} onPress={() => setOpen(true)} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Text style={[styles.fieldText, !selected && styles.fieldPlaceholder]}>
            {selected ? `${selected.name} (${selected.code})` : 'Select subject'}
          </Text>
        )}
        <FontAwesome5 name="chevron-down" size={13} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: sheetBottom }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Select subject</Text>

            {error && <ErrorNotice message={error} />}

            <FlatList
              keyboardShouldPersistTaps="handled"
              data={subjects}
              keyExtractor={(item) => item.id}
              style={styles.list}
              ListEmptyComponent={!loading ? <Text style={styles.empty}>No subjects yet.</Text> : null}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.option, selectedId === item.id && styles.optionSelected]}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, selectedId === item.id && styles.optionTextSelected]}>
                    {item.name} ({item.code})
                  </Text>
                  {selectedId === item.id && <FontAwesome5 name="check" size={13} color={colors.white} />}
                </Pressable>
              )}
            />

            {showCreate ? (
              <View style={styles.createForm}>
                <LabeledInput label="Code" value={code} onChangeText={setCode} placeholder="e.g. MATH" autoCapitalize="characters" />
                <LabeledInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Mathematics" />
                <Pressable style={styles.createButton} onPress={handleCreate} disabled={creating}>
                  <Text style={styles.createButtonText}>{creating ? 'Creating…' : 'Create & select'}</Text>
                </Pressable>
                <Pressable onPress={() => setShowCreate(false)}>
                  <Text style={styles.cancel}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setShowCreate(true)}>
                <Text style={styles.addNew}>+ New subject</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm,
  },
  fieldText: { fontSize: 15, color: colors.textPrimary },
  fieldPlaceholder: { color: colors.textMuted },
  error: { color: colors.error, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, marginBottom: spacing.sm, textAlign: 'center' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '70%',
    ...softShadow,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  list: { flexGrow: 0, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  optionSelected: { backgroundColor: colors.primary },
  optionText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  optionTextSelected: { color: colors.white },
  addNew: { color: colors.primary, fontWeight: '700', marginTop: spacing.xs, textAlign: 'center' },
  createForm: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...softShadow,
  },
  createButtonText: { color: colors.white, fontWeight: '600' },
  cancel: { color: colors.textMuted, textAlign: 'center' },
});
