import { Text, TextInput, TextInputProps, View } from 'react-native';

type AuthTextInputProps = TextInputProps & {
  label: string;
};

export default function AuthTextInput({ label, style, ...props }: AuthTextInputProps) {
  return (
    <View className="w-full mb-4">
      <Text className="text-sm font-sans-medium text-ink-700 mb-2">{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#A0AEC0"
        className="border border-stroke-200 rounded-2xl px-4 py-3 text-base text-ink-900 font-sans"
        style={style}
      />
    </View>
  );
}
