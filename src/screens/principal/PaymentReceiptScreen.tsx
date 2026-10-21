import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { downloadFeeReceiptPdf, getFeePayment } from '../../api/feePayments';
import type { FeePayment } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { usePdfDownload } from '../../hooks/usePdfDownload';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { formatInstantDate } from '../../utils/feeBills';
import { formatPaymentDate, paymentMethodLabelKey, REVERSAL_TYPE_KEYS } from '../../utils/feePayments';
import { formatRupees } from '../../utils/money';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PaymentReceipt'>;

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

/**
 * A fee payment's receipt: everything the server sends for it, CANCELLED (with how, when, by whom
 * and why) once reversed, and the server's PDF to share. Opened with the payment itself (after
 * recording, or from a history list) or just its id; either way it's fetched again on focus, so a
 * reversal made meanwhile shows.
 */
export function PaymentReceiptScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const schoolId = useSchoolId();
  const paymentId = route.params.payment?.id ?? route.params.paymentId;
  const [payment, setPayment] = useState<FeePayment | null>(route.params.payment ?? null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pdf = usePdfDownload(t('fees.receipt.shareTitle'));

  // ReversePayment hands back the reversed payment by merging it into this route's params; show it
  // straight away (updated during render, React's pattern for state that follows a prop).
  const [shownParam, setShownParam] = useState(route.params.payment);
  if (route.params.payment && route.params.payment !== shownParam) {
    setShownParam(route.params.payment);
    setPayment(route.params.payment);
  }

  const load = useCallback(() => {
    if (!paymentId) return () => {};
    let active = true;
    setLoading(true);
    setLoadError(null);
    getFeePayment(schoolId, paymentId)
      .then((fresh) => {
        if (active) setPayment(fresh);
      })
      .catch((e) => {
        if (active) setLoadError(`${t('fees.receipt.loadError')} ${getErrorMessage(e)}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [schoolId, paymentId, t]);

  useFocusEffect(load);

  const header = <ScreenHeader title={t('fees.receipt.title')} onBack={() => navigation.goBack()} />;

  if (!payment) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.content}>
          {loading || !loadError ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : (
            <>
              <ErrorNotice message={loadError} />
              <Pressable style={styles.doneButton} onPress={load} accessibilityRole="button">
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }

  const methodLabel = (method: string | null | undefined) => {
    const key = paymentMethodLabelKey(method);
    return key ? t(key) : (method ?? '—');
  };
  const reversal = payment.reversed ? payment.reversal : null;
  const canReverse = session.role === 'ADMIN' && !payment.reversed;

  return (
    <View style={styles.root}>
      {header}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {payment.reversed && (
          <View style={styles.cancelledBanner} accessibilityRole="alert">
            <Text style={styles.cancelledTitle}>{t('fees.receipt.cancelled')}</Text>
            {reversal && (
              <>
                <Text style={styles.cancelledType}>{t(REVERSAL_TYPE_KEYS[reversal.type]?.label ?? reversal.type)}</Text>
                <Text style={styles.cancelledLine}>
                  {t('fees.receipt.cancelledBy', {
                    date: formatInstantDate(reversal.reversedAt, t),
                    name: reversal.reversedByName ?? '—',
                  })}
                </Text>
                {reversal.type === 'REFUND' && (
                  <Text style={styles.cancelledLine}>
                    {t('fees.receipt.refundDetails', {
                      method: methodLabel(reversal.refundMethod),
                      reference: reversal.refundReference ?? '—',
                      date: formatPaymentDate(reversal.refundDate, t),
                    })}
                  </Text>
                )}
                <Text style={styles.cancelledLine}>{t('fees.receipt.reason', { reason: reversal.reason })}</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.card}>
          {payment.schoolLogoUrl ? (
            <Image source={{ uri: payment.schoolLogoUrl }} style={styles.logo} resizeMode="contain" />
          ) : null}
          <Text style={styles.schoolName}>{payment.schoolName}</Text>
          <Text style={styles.receiptSubtitle}>{t('fees.receipt.subtitle')}</Text>
          <View style={styles.divider} />
          <Row label={t('fees.receipt.receiptNumber')} value={payment.receiptNumber} />
          <Row label={t('fees.receipt.date')} value={formatPaymentDate(payment.transactionDate, t)} />
          <Row label={t('fees.receipt.studentName')} value={payment.studentName} />
          <Row label={t('fees.receipt.rollNumber')} value={payment.rollNumber} />
          <Row label={t('fees.receipt.classSection')} value={payment.classSectionLabel} />
          <Row label={t('fees.receipt.academicYear')} value={payment.academicYear} />
          <Row label={t('fees.receipt.paymentMethod')} value={methodLabel(payment.paymentMethod)} />
          {payment.paymentReference ? (
            <Row label={t('fees.receipt.paymentReference')} value={payment.paymentReference} />
          ) : null}
          {payment.recordedByName ? <Row label={t('fees.receipt.receivedBy')} value={payment.recordedByName} /> : null}
          <View style={styles.divider} />
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>{t('fees.receipt.amountPaid')}</Text>
            <Text style={[styles.amountValue, payment.reversed && styles.amountCancelled]}>
              {formatRupees(payment.amount, { decimals: 'always' })}
            </Text>
          </View>
          {payment.balanceAfter != null ? (
            <Row label={t('fees.receipt.balanceAfter')} value={formatRupees(payment.balanceAfter, { decimals: 'always' })} />
          ) : null}
        </View>

        <Pressable
          style={[styles.primaryButton, pdf.busy && styles.buttonDisabled]}
          onPress={() => pdf.run(() => downloadFeeReceiptPdf(schoolId, payment))}
          disabled={pdf.busy}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>{pdf.busy ? t('fees.receipt.sharing') : t('fees.receipt.sharePdf')}</Text>
        </Pressable>

        {canReverse && (
          <Pressable
            style={styles.reverseButton}
            onPress={() => navigation.navigate('ReversePayment', { payment })}
            accessibilityRole="button"
          >
            <Text style={styles.reverseButtonText}>{t('fees.reversePayment.button')}</Text>
          </Pressable>
        )}

        <Pressable style={styles.doneButton} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.doneButtonText}>{t('common.done')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  loading: { marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  logo: { width: 72, height: 72, alignSelf: 'center', marginBottom: spacing.sm },
  schoolName: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  receiptSubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 2, marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, gap: spacing.md },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  amountLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  amountValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  amountCancelled: { color: colors.textMuted, textDecorationLine: 'line-through' },
  cancelledBanner: {
    backgroundColor: '#FDECEC',
    borderColor: '#F5C2C2',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  cancelledTitle: { fontSize: 18, fontWeight: '800', color: colors.error, letterSpacing: 1 },
  cancelledType: { fontSize: 14, fontWeight: '700', color: '#8E1B1B', marginTop: spacing.xs },
  cancelledLine: { fontSize: 13, color: '#8E1B1B', marginTop: spacing.xs, lineHeight: 18 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: colors.white, fontWeight: '700' },
  reverseButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  reverseButtonText: { color: colors.error, fontWeight: '700' },
  doneButton: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  doneButtonText: { color: colors.textMuted, fontWeight: '600' },
  retryText: { color: colors.primary, fontWeight: '700' },
});
