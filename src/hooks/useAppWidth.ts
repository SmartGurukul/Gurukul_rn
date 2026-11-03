import { Platform, useWindowDimensions } from 'react-native';

/**
 * On a wide browser window the web app (smartgurukul.org/app) is shown as a phone-width column
 * (public/index.html caps #root at this width), so layouts that size themselves from the window
 * must use this instead of the raw window width.
 */
export const WEB_APP_MAX_WIDTH = 480;

export function useAppWidth(): number {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' ? Math.min(width, WEB_APP_MAX_WIDTH) : width;
}
