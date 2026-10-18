import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WebView } from 'react-native-webview';

import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'WebDocument'>;

/**
 * Shows a web document in-app: the NCERT chapter PDFs on iOS, where the WebView renders PDFs. When
 * the page cannot load (offline, or a link NCERT has moved) the screen offers the system browser.
 */
export function WebDocumentScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { url, title } = route.params;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <View style={styles.root}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      {failed ? (
        <View style={styles.failed}>
          <Text style={styles.failedText}>{t('webDocument.failed')}</Text>
          <Pressable style={styles.button} onPress={() => Linking.openURL(url).catch(() => {})}>
            <Text style={styles.buttonText}>{t('webDocument.openInBrowser')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.stage}>
          <WebView
            source={{ uri: url }}
            style={styles.web}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
            originWhitelist={['https://*', 'http://*']}
          />
          {loading ? (
            <View style={styles.loading} pointerEvents="none">
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>{t('webDocument.loading')}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  stage: { flex: 1 },
  web: { flex: 1, backgroundColor: colors.background },
  loading: { position: 'absolute', top: spacing.xl, left: 0, right: 0, alignItems: 'center', gap: spacing.sm },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  failed: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  failedText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  button: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  buttonText: { color: colors.white, fontWeight: '700' },
});
