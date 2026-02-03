import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

export default function AuthLayout() {
  const { user, initializing } = useAuthStore();

  if (initializing) {
    return null;
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: 'center',
      }}
    />
  );
}
