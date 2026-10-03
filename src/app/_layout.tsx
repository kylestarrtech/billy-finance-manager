import { useEffect, useRef } from 'react';
import { Appearance, AppState, Platform } from 'react-native';
import { Stack, ThemeProvider, DarkTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenCapture from 'expo-screen-capture';
import { useFonts } from 'expo-font';

import ErrorBoundary from '../components/ErrorBoundary';
import { FinanceProvider, useFinance } from '../context/FinanceContext';
import { colors, fontAssets } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// The app is dark-only. Forcing it on iOS makes the native tab bar's Liquid Glass render dark too,
// whatever the system appearance is (Android's tab bar colours are set explicitly instead).
if (Platform.OS === 'ios') Appearance.setColorScheme('dark');

// On desktop the vault re-locked whenever the app was closed. Phones keep apps alive in the background
// for days, so the equivalent is to re-lock after the app has been backgrounded for a while.
const AUTO_LOCK_AFTER_MS = 2 * 60 * 1000;

// Hides financial data from the OS app-switcher preview while the vault is unlocked. iOS blurs the
// snapshot natively. Android's only equivalent is FLAG_SECURE, which ALSO blocks screenshots and screen
// recording inside the app, so it's opt-in: flip this to true if you want that trade-off.
const PROTECT_ANDROID_RECENTS = false;

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gain,
    background: colors.bg,
    card: colors.bg,
    text: colors.textMain,
    border: colors.border,
  },
};

function RootNavigator() {
  const { authStatus, lockVault } = useFinance();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const backgroundedAt = useRef<number | null>(null);

  const isReady = (fontsLoaded || !!fontError) && authStatus !== 'loading';
  const isUnlocked = authStatus === 'unlocked';

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync().catch(() => {});
  }, [isReady]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background') {
        backgroundedAt.current ??= Date.now();
      } else if (next === 'active') {
        if (backgroundedAt.current && Date.now() - backgroundedAt.current > AUTO_LOCK_AFTER_MS) {
          lockVault();
        }
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [lockVault]);

  useEffect(() => {
    if (!isUnlocked) return;
    if (Platform.OS === 'ios') {
      ScreenCapture.enableAppSwitcherProtectionAsync(0.8).catch(() => {});
      return () => {
        ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
      };
    }
    if (PROTECT_ANDROID_RECENTS) {
      ScreenCapture.preventScreenCaptureAsync('vault').catch(() => {});
      return () => {
        ScreenCapture.allowScreenCaptureAsync('vault').catch(() => {});
      };
    }
  }, [isUnlocked]);

  // The native splash screen stays up until fonts and the vault status are ready.
  if (!isReady) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {/* Locking/unlocking flips these guards; Expo Router swaps screens and clears the other's history. */}
        <Stack.Protected guard={isUnlocked}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!isUnlocked}>
          <Stack.Screen name="unlock" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <FinanceProvider>
        <ThemeProvider value={theme}>
          <RootNavigator />
        </ThemeProvider>
      </FinanceProvider>
    </ErrorBoundary>
  );
}
