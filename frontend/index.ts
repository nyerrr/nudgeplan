import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

// Keep keyboard focus visible on web without changing the app's native styles.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const focusStyle = document.createElement('style');
  focusStyle.textContent = `
    [role="button"]:focus-visible,
    [role="checkbox"]:focus-visible,
    [role="switch"]:focus-visible,
    [role="tab"]:focus-visible,
    a:focus-visible {
      outline: 3px solid #2563EB;
      outline-offset: 2px;
      box-shadow: 0 0 0 5px #FFFFFF;
    }
  `;
  document.head.appendChild(focusStyle);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
