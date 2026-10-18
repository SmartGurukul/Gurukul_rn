import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'VideoPlayer'>;

/**
 * Plays one published chapter or topic video from its public URL with the platform's own controls
 * (scrubbing, fullscreen, volume). The player starts on open and stops when the screen goes away.
 */
export function VideoPlayerScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { url, title } = route.params;
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(
    () => () => {
      try {
        player.pause();
      } catch {
        // Already released with the screen.
      }
    },
    [player]
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title={title} subtitle={t('videoPlayer.title')} onBack={() => navigation.goBack()} />
      <View style={styles.stage}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
          fullscreenOptions={{ enable: true }}
          allowsPictureInPicture={false}
        />
      </View>
      <Text style={styles.hint}>{t('videoPlayer.hint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  stage: { backgroundColor: '#000000', aspectRatio: 16 / 9, width: '100%', marginTop: spacing.lg },
  video: { flex: 1 },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.lg },
});
