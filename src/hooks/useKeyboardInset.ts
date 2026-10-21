import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions, type KeyboardEvent } from 'react-native';

/**
 * How much extra bottom space a screen needs while the soft keyboard is open, so the field being
 * typed into and the button under it stay reachable.
 *
 * On iOS the window never shrinks, so this is the keyboard's height. On Android the window usually
 * shrinks by itself (adjustResize), in which case this is 0; on builds where it does not (edge-to-edge
 * on newer Android), the part the window did not absorb is returned. Either way the caller just adds
 * the value as bottom padding, with no double-counting.
 */
export function useKeyboardInset(enabled = true): number {
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // The window height just before the keyboard came up, to measure how much of it the OS took.
  const heightBeforeKeyboard = useRef(windowHeight);
  const keyboardOpen = useRef(false);

  useEffect(() => {
    if (!keyboardOpen.current) heightBeforeKeyboard.current = windowHeight;
  }, [windowHeight]);

  useEffect(() => {
    if (!enabled) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => {
      keyboardOpen.current = true;
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    };
    const onHide = () => {
      keyboardOpen.current = false;
      setKeyboardHeight(0);
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled]);

  if (!enabled || keyboardHeight === 0) return 0;
  const absorbedByWindow = Math.max(0, heightBeforeKeyboard.current - windowHeight);
  return Math.max(0, keyboardHeight - absorbedByWindow);
}
