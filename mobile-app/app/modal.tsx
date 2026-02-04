import { StatusBar } from 'expo-status-bar';
import { View, Text, Platform } from 'react-native';

export default function ModalScreen() {
  return (
    <View className="flex-1 bg-surface-0">
      <View className="flex-1 px-5 py-6">
        <Text className="font-sans-bold text-xl text-ink-900">Modal</Text>
        <Text className="mt-2 font-sans text-sm text-ink-500">This is a placeholder modal screen.</Text>
        <View className="mt-5 h-px bg-stroke-100" />
      </View>

      <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
    </View>
  );
}
