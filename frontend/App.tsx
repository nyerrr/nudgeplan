import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { TabBar } from './src/components/TabBar';
import { TaskSheet } from './src/components/TaskSheet';
import { Toast } from './src/components/Toast';
import { AuthProvider, useAuth } from './src/auth';
import { AboutScreen } from './src/screens/AboutScreen';
import { CheckInScreen } from './src/screens/CheckInScreen';
import { FocusScreen } from './src/screens/FocusScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { LogoutScreen } from './src/screens/LogoutScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { PrivacyScreen } from './src/screens/PrivacyScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AppProvider, useApp } from './src/state';

function CurrentScreen() {
  const { screen } = useApp();
  switch (screen) {
    case 'plan':
      return <PlanScreen />;
    case 'checkin':
      return <CheckInScreen />;
    case 'focus':
      return <FocusScreen />;
    case 'insights':
      return <InsightsScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'privacy':
      return <PrivacyScreen />;
    case 'about':
      return <AboutScreen />;
    default:
      return <HomeScreen />;
  }
}

function Root() {
  const { hydrated, colors, mode, state } = useApp();
  const {
    hydrated: authHydrated,
    user,
    justSignedOut,
    clearSignedOut,
  } = useAuth();

  if (!hydrated || !authHydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  if (!user) {
    return (
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        {justSignedOut ? (
          <LogoutScreen onSignBackIn={clearSignedOut} />
        ) : (
          <LoginScreen />
        )}
      </SafeAreaView>
    );
  }

  if (!state.onboarded) {
    return (
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <OnboardingScreen />
        <Toast />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <View style={styles.frame}>
        <View style={{ flex: 1 }}>
          <CurrentScreen />
        </View>
        <TabBar />
        <Toast />
        <TaskSheet />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  // A font failure used to leave the app on the splash-coloured blank screen
  // forever. Render with fallback fonts instead.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: '#D6EDFF' }} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppProvider>
          <Root />
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
