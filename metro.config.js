// Metro config: Expo's defaults, plus web-only stand-ins for native modules that have no (or an
// empty) web implementation. Used by the web build of the app served at smartgurukul.org/app
// (`npm run build:web`); Android and iOS bundles resolve the real modules exactly as before.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const WEB_SHIMS = {
  'expo-secure-store': 'src/web/secureStore.ts',
  'expo-file-system': 'src/web/fileSystem.ts',
  'expo-sharing': 'src/web/sharing.ts',
  'react-native-webview': 'src/web/webView.tsx',
  '@react-native-community/datetimepicker': 'src/web/dateTimePicker.tsx',
};

const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) {
    return { type: 'sourceFile', filePath: path.join(__dirname, WEB_SHIMS[moduleName]) };
  }
  return upstreamResolve ? upstreamResolve(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
