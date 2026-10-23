import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlanProvider } from '../src/store/PlanContext';
import { colors } from '../src/theme';

/**
 * Root layout.
 *
 * The stack holds the four tabs plus the modal flows (task confirmation,
 * reality check, task detail). Modals sit on top of the tabs so the
 * back gesture returns to wherever the user came from.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PlanProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="confirm"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="reality-check"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="task/[id]"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack>
      </PlanProvider>
    </SafeAreaProvider>
  );
}
