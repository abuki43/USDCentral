import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AppState } from 'react-native';
import { useEffect, useRef } from 'react';
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


export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initializeAuth = useAuthStore((state) => state.initialize);
  const initializeLocalAuth = useLocalAuthStore((state) => state.initialize);
  const lockLocalAuth = useLocalAuthStore((state) => state.lock);
  const localAuthEnabled = useLocalAuthStore((state) => state.isEnabled);
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    initializeLocalAuth();
  }, [initializeLocalAuth]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && localAuthEnabled) {
        lockLocalAuth();
      }
    });

    return () => subscription.remove();
  }, [localAuthEnabled, lockLocalAuth]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const { user, initializing } = useAuthStore();
  const { isEnabled, isLocked, isInitialized } = useLocalAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const lastNavKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (initializing || !isInitialized) {
      return;
    }

    const shouldLock = Boolean(user && isEnabled && isLocked);
    const navKey = `${shouldLock}:${pathname}`;

    if (lastNavKeyRef.current === navKey) return;

    if (shouldLock) {
      if (pathname !== '/lock') {
        lastNavKeyRef.current = navKey;
        router.replace('/lock');
      }
      return;
    }

    // If we got unlocked while on the lock screen, return to the app.
    if (pathname === '/lock') {
      lastNavKeyRef.current = navKey;
      router.replace('/(tabs)');
    }
  }, [user, isEnabled, isLocked, pathname, router]);

  if (initializing || !isInitialized) {
    return null;
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="lock" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
