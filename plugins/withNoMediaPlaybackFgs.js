const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSION = 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK';
const SERVICE = 'expo.modules.audio.service.AudioControlsService';

/**
 * expo-audio always injects a mediaPlayback foreground service + its permission, but this app never
 * plays audio in the background (expo-audio is used only for the mic permission in video calls, and
 * lesson videos play on-screen only). An unused FOREGROUND_SERVICE_MEDIA_PLAYBACK makes Google Play
 * demand a media-playback demo video, so we strip both at prebuild. Must run AFTER expo-audio in the
 * plugins list. Location's foreground service (bus tracking) is left untouched.
 */
module.exports = function withNoMediaPlaybackFgs(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (p) => p?.$?.['android:name'] !== PERMISSION
      );
    }

    const application = manifest.application?.[0];
    if (application && Array.isArray(application.service)) {
      application.service = application.service.filter(
        (s) => s?.$?.['android:name'] !== SERVICE
      );
    }

    return config;
  });
};
