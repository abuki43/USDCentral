import { Link, Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center bg-surface-0 px-6">
        <Text className="font-sans-bold text-xl text-ink-900">This screen doesn't exist.</Text>
        <Text className="mt-2 text-center font-sans text-sm text-ink-500">
          The link you followed may be broken.
        </Text>

        <Link href="/" asChild>
          <Pressable className="mt-5 rounded-xl bg-primary-600 px-4 py-3 active:opacity-90">
            <Text className="font-sans-semibold text-sm text-white">Go to home</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
