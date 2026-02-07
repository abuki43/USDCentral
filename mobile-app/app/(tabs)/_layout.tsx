import { View, StyleSheet } from 'react-native';
import { useRouter, usePathname, Slot } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import FloatingDock from '@/components/ui/FloatingDock';
import { useEffect } from 'react';

export default function TabLayout() {
  const { user, initializing } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!initializing && user && pathname === '/(tabs)') {
      router.replace('/(tabs)/index' as any);
    }
  }, [initializing, user, pathname]);

  if (initializing) {
    return null;
  }

  if (!user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Slot />
      <FloatingDock />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
