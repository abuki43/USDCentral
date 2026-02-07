import { View, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const TABS = [
  { name: 'index', label: 'Home', icon: 'home' as const },
  { name: 'earn', label: 'Earn', icon: 'trending-up' as const },
  { name: 'two', label: 'Deposit', icon: 'wallet' as const },
  { name: 'profile', label: 'Profile', icon: 'person' as const },
];

export default function FloatingDock() {
  const router = useRouter();
  const pathname = usePathname();

  const navigateTo = (name: string) => {
    if (name === 'index') {
      router.replace('/(tabs)');
    } else {
      router.replace(`/(tabs)/${name}` as any);
    }
  };

  const isActive = (name: string) => {
    if (name === 'index') {
      return pathname === '/(tabs)' || pathname === '/(tabs)/index' || pathname === '/(tabs)/index' || pathname === '/';
    }
    if (name === 'earn') {
      return pathname.includes('/earn');
    }
    if (name === 'two') {
      return pathname.includes('/two') || pathname.includes('/deposit');
    }
    if (name === 'profile') {
      return pathname.includes('/profile');
    }
    return false;
  };

  return (
    <View style={styles.container}>
      <View style={styles.dock}>
        {TABS.map((tab) => {
          const active = isActive(tab.name);
          return (
            <Pressable
              key={tab.name}
              style={styles.tab}
              onPress={() => navigateTo(tab.name)}
              android_ripple={{ color: 'rgba(99, 102, 241, 0.1)' }}
            >
              <View style={[styles.iconContainer, active && styles.iconContainerActive]}>
                <Ionicons
                  name={tab.icon}
                  size={active ? 24 : 22}
                  color={active ? '#FFFFFF' : '#64748B'}
                />
              </View>
              {!active && (
                <Text style={styles.label}>
                  {tab.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dock: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 32,
    padding: 6,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    gap: 12,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    height: 56,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerActive: {
    backgroundColor: '#0F172A',
    width: 48,
    height: 48,
    borderRadius: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
});
