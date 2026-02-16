import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AppState, View, StyleSheet } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import 'react-native-reanimated';

import '../global.css';

import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { useAuthStore } from '@/store/authStore';
import { useLocalAuthStore } from '@/store/localAuthStore';
import LockScreen from './lock';


export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  if (!fontsLoaded) {
    return null;
  }

  return <RootLayoutNav onReady={() => SplashScreen.hideAsync()} />;
}

function RootLayoutNav({ onReady }: { onReady: () => void }) {
  const { user, initializing, initialize: initAuth } = useAuthStore();
  const {
    isInitialized: localAuthInitialized,
    isEnabled: localAuthEnabled,
    isLocked,
    initialize: initLocalAuth,
    lock: doLock,
  } = useLocalAuthStore();

  const [localAuthError, setLocalAuthError] = useState(false);

  useEffect(() => {
    // Start initializations
    try {
        initAuth();
    } catch (e) {
        console.log('Firebase auth init failed:', e);
    }

    initLocalAuth().catch((e) => {
      console.log('Local auth init failed, continuing without PIN:', e);
      setLocalAuthError(true);
    });
  }, []);

  useEffect(() => {
    // Wait for both auth systems to settle before hiding splash
    const isAuthReady = !initializing;
    const isLocalAuthReady = localAuthInitialized || localAuthError;

    if (isAuthReady && isLocalAuthReady) {
      onReady();
    }
  }, [initializing, localAuthInitialized, localAuthError, onReady]);

  useEffect(() => {
    // Monitor AppState to lock immediately when backgrounded
    const subscription = AppState.addEventListener('change', (state) => {
      if (state.match(/inactive|background/) && localAuthEnabled && !localAuthError) {
        doLock();
      }
    });

    return () => subscription.remove();
  }, [localAuthEnabled, localAuthError, doLock]);

  const showLockOverlay = user && localAuthEnabled && isLocked && !localAuthError;

  return (
    <View style={styles.container}>
      <ThemeProvider value={DefaultTheme}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="lock" />
        </Stack>

        {showLockOverlay && (
          <View style={StyleSheet.absoluteFill}>
            <LockScreen isOverlay />
          </View>
        )}
      </ThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
