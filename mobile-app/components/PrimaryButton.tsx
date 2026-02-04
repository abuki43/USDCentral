import { Pressable, Text } from 'react-native';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export default function PrimaryButton({ label, onPress, disabled }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={[
        'w-full rounded-2xl px-4 py-4 items-center justify-center',
        'bg-primary-500',
        'shadow-sm',
        disabled ? 'opacity-50' : 'opacity-100',
      ].join(' ')}
      android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
    >
      <Text className="text-white text-base font-sans-semibold">{label}</Text>
    </Pressable>
  );
}
