import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { HabitsProvider } from '@/context/habits-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function OnboardingGate() {
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key) return;
    AsyncStorage.getItem('onboarded_v2').then((val) => {
      if (!val) router.navigate('/onboarding');
    });
  }, [navState?.key]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <HabitsProvider>
        <OnboardingGate />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="how-to" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </HabitsProvider>
    </ThemeProvider>
  );
}
