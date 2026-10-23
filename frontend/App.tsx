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
import { View } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { TabBar } from './src/components/TabBar';
import { TaskSheet } from './src/components/TaskSheet';
import { Toast } from './src/components/Toast';
import { AboutScreen } from './src/screens/AboutScreen';
import { CheckInScreen } from './src/screens/CheckInScreen';
import { FocusScreen } from './src/screens/FocusScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
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

  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
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
      <View style={{ flex: 1 }}>
        <CurrentScreen />
      </View>
      <TabBar />
      <Toast />
      <TaskSheet />
    </SafeAreaView>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#F3F5FF' }} />;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
