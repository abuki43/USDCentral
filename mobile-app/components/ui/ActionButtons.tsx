import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type ActionButton = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: 'withdraw' | 'send' | 'deposit';
  onPress?: () => void;
};

const ACTIONS: Omit<ActionButton, 'onPress'>[] = [
  { label: 'Withdraw', icon: 'arrow-down-circle', variant: 'withdraw' },
  { label: 'Send', icon: 'send', variant: 'send' },
  { label: 'Deposit', icon: 'wallet', variant: 'deposit' },
];

const getIconStyle = (variant: string) => {
  switch (variant) {
    case 'withdraw':
      return styles.iconWithdraw;
    case 'send':
      return styles.iconSend;
    case 'deposit':
      return styles.iconDeposit;
    default:
      return styles.iconSend;
  }
};

export default function ActionButtons() {
  const router = useRouter();

  const handlePress = (variant: ActionButton['variant']) => {
    switch (variant) {
      case 'withdraw':
        router.push('/withdraw');
        break;
      case 'send':
        router.push('/send');
        break;
      case 'deposit':
        router.push('/(tabs)/two');
        break;
    }
  };

  return (
    <View style={styles.container}>
      {ACTIONS.map((action) => (
        <Pressable
          key={action.label}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => handlePress(action.variant)}
          android_ripple={{ color: 'rgba(99, 102, 241, 0.1)' }}
        >
          <View style={[styles.iconContainer, getIconStyle(action.variant)]}>
            <Ionicons name={action.icon} size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.label}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Changed from gap to space-around for better distribution
    marginBottom: 24,
    marginTop: 32, // Increased top margin to clear the card's glow effect (20px)
  },
  button: {
    // flex: 1, // Removed flex: 1 to prevent stretching
    alignItems: 'center',
    padding: 8, // Reduced padding
    // Removed background and shadows to make it "perfect" and clean
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  iconContainer: {
    width: 48, // Slightly smaller icons
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconWithdraw: {
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  iconSend: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  iconDeposit: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
});
