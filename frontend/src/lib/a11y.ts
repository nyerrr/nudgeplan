import { Platform } from 'react-native';

/**
 * Accessibility state helper.
 *
 * React Native exposes a single `accessibilityState` prop, but
 * react-native-web accepts it and then never reads it - it only
 * understands flat `aria-*` attributes. Passing `accessibilityState` alone
 * therefore produces a control with no state on the web build, which is
 * both an ARIA violation (a checkbox must always carry `aria-checked`) and
 * useless to a screen reader.
 *
 * Spreading the result of `a11yState()` gives each platform the shape it
 * understands, so the same component tree works on Android and in the
 * browser.
 *
 * Note the key semantics: `checked` maps to `aria-checked` (checkbox and
 * radio roles), `selected` maps to `aria-selected` (tab and option roles).
 */

export type A11yState = {
  /** checkbox / radio - is this control ticked? */
  checked?: boolean;
  /** tab / option - is this option the current one? */
  selected?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  busy?: boolean;
};

export function a11yState(state: A11yState): Record<string, unknown> {
  if (Platform.OS !== 'web') {
    return { accessibilityState: state };
  }
  const aria: Record<string, boolean> = {};
  if (state.checked !== undefined) aria['aria-checked'] = state.checked;
  if (state.selected !== undefined) aria['aria-selected'] = state.selected;
  if (state.disabled !== undefined) aria['aria-disabled'] = state.disabled;
  if (state.expanded !== undefined) aria['aria-expanded'] = state.expanded;
  if (state.busy !== undefined) aria['aria-busy'] = state.busy;
  return aria;
}
