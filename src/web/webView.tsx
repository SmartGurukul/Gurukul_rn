/**
 * Web stand-in for react-native-webview: an <iframe>. Supports what the app uses - `source.uri`
 * (documents such as the privacy policy) and `source.html` (the bus map), `onLoadEnd`, and
 * `injectJavaScript` on the ref for same-origin srcdoc pages. Wired in for web builds only, by
 * metro.config.js.
 */
import { createElement, forwardRef, useImperativeHandle, useRef, type CSSProperties } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

type Source = { uri?: string; html?: string; baseUrl?: string };

interface Props {
  source?: Source;
  style?: StyleProp<ViewStyle>;
  onLoadEnd?: () => void;
  onLoad?: () => void;
  // Native-only props (originWhitelist, javaScriptEnabled, ...) are accepted and ignored.
  originWhitelist?: string[];
  javaScriptEnabled?: boolean;
  scrollEnabled?: boolean;
}

export interface WebViewHandle {
  injectJavaScript: (script: string) => void;
  reload: () => void;
  goBack: () => void;
}

/** Leaflet and friends need absolute URLs; a <base> gives srcdoc pages the baseUrl native gets. */
function withBase(html: string, baseUrl?: string) {
  if (!baseUrl || /<base\s/i.test(html)) return html;
  return html.replace(/<head>/i, `<head><base href="${baseUrl}">`);
}

const frameStyle: CSSProperties = { border: 0, width: '100%', height: '100%', flex: 1 };

export const WebView = forwardRef<WebViewHandle, Props>(function WebView({ source, style, onLoadEnd, onLoad }, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);

  useImperativeHandle(ref, () => ({
    injectJavaScript(script: string) {
      const win = frame.current?.contentWindow as (Window & { eval?: (s: string) => unknown }) | null | undefined;
      try {
        win?.eval?.(script);
      } catch (e) {
        console.warn('[webview] injectJavaScript failed', e);
      }
    },
    reload() {
      frame.current?.contentWindow?.location.reload();
    },
    goBack() {
      frame.current?.contentWindow?.history.back();
    },
  }));

  const iframe = createElement('iframe', {
    ref: frame,
    style: frameStyle,
    src: source?.html === undefined ? source?.uri : undefined,
    srcDoc: source?.html !== undefined ? withBase(source.html, source.baseUrl) : undefined,
    onLoad: () => {
      onLoad?.();
      onLoadEnd?.();
    },
  });

  return <View style={[{ flex: 1, overflow: 'hidden' }, style]}>{iframe}</View>;
});

export default WebView;
