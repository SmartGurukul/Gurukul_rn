const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const PERMISSION = 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK';
const SERVICE = 'expo.modules.audio.service.AudioControlsService';

/**
 * expo-audio always ships a mediaPlayback foreground service + its permission in its OWN library
 * manifest (the AAR). This app never plays audio in the background - expo-audio is used only for the
 * mic permission in video calls, and lesson videos play on-screen via expo-video - so the permission
 * is unused, and Google Play then demands a media-playback demo video for it.
 *
 * Filtering the entries out of the app manifest at prebuild is NOT enough: Android's manifest merger
 * re-adds them from expo-audio's library manifest during the gradle build, after this plugin runs.
 * The only reliable way to drop a dependency-provided entry is a `tools:node="remove"` marker in the
 * app manifest, which the merger honours. So we inject removal stubs (and ensure xmlns:tools exists).
 * Location's foreground service (bus tracking) is left untouched.
 */
module.exports = function withNoMediaPlaybackFgs(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure xmlns:tools is declared on <manifest>, or tools:node is ignored by the merger.
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // Drop any plain copy we may have added before, then add a single removal marker.
    const perms = Array.isArray(manifest['uses-permission']) ? manifest['uses-permission'] : [];
    manifest['uses-permission'] = perms.filter((p) => p?.$?.['android:name'] !== PERMISSION);
    manifest['uses-permission'].push({
      $: { 'android:name': PERMISSION, 'tools:node': 'remove' },
    });

    // Same for the service expo-audio registers with foregroundServiceType="mediaPlayback".
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const services = Array.isArray(application.service) ? application.service : [];
    application.service = services.filter((s) => s?.$?.['android:name'] !== SERVICE);
    application.service.push({ $: { 'android:name': SERVICE, 'tools:node': 'remove' } });

    return config;
  });
};
