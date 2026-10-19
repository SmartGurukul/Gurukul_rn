import {
  Mukta_400Regular,
  Mukta_500Medium,
  Mukta_600SemiBold,
  Mukta_700Bold,
} from '@expo-google-fonts/mukta';
import { Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import type { TextStyle } from 'react-native';

/**
 * Brand type: Poppins for headings, numbers and buttons; Mukta for body text and for all Hindi
 * (Poppins has no Devanagari, so a Hindi heading also uses Mukta). Weights are separate font
 * families on native, so pick the family rather than setting `fontWeight`.
 */
export const fonts = {
  heading: 'Poppins_700Bold',
  headingMedium: 'Poppins_600SemiBold',
  label: 'Poppins_500Medium',
  body: 'Mukta_400Regular',
  bodyMedium: 'Mukta_500Medium',
  bodySemibold: 'Mukta_600SemiBold',
  bodyBold: 'Mukta_700Bold',
} as const;

const FONT_MAP = {
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Mukta_400Regular,
  Mukta_500Medium,
  Mukta_600SemiBold,
  Mukta_700Bold,
};

/**
 * Loads the brand fonts once at start-up. Returns true when the fonts are ready, and also true if
 * loading failed (the app then renders in the system font rather than never starting).
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FONT_MAP);
  return loaded || !!error;
}

/** Type scale from the design's tokens board. Hindi strings should use the Mukta variants. */
export const type = {
  display: { fontFamily: fonts.heading, fontSize: 32, lineHeight: 40 },
  title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28 },
  number: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 28 },
  numberLarge: { fontFamily: fonts.heading, fontSize: 40, lineHeight: 44 },
  heading: { fontFamily: fonts.headingMedium, fontSize: 17, lineHeight: 24 },
  headingHi: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 26 },
  button: { fontFamily: fonts.headingMedium, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.headingMedium, fontSize: 13, lineHeight: 18 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  captionStrong: { fontFamily: fonts.bodySemibold, fontSize: 12, lineHeight: 16 },
} as const satisfies Record<string, TextStyle>;
