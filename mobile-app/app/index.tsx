import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

export default function IndexScreen() {
  const { user, initializing } = useAuthStore();

  if (initializing) {
    return null;
  }

  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />;
}
