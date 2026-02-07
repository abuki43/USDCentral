import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useLocalAuthStore } from '@/store/localAuthStore';

export default function LockScreen({ isOverlay = false }: { isOverlay?: boolean }) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const {
    isEnabled,
    isLocked,
    biometricsEnabled,
    unlockWithPin,
    unlockWithBiometrics,
    errorMessage,
    clearError,
  } = useLocalAuthStore();
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  if (!isOverlay && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!isOverlay && (!isEnabled || !isLocked)) {
    return <Redirect href="/(tabs)" />;
  }

  const handlePinUnlock = async () => {
    const success = await unlockWithPin(pin);
    if (success) {
      setPin('');
      setPinError(null);
    } else {
      setPinError(errorMessage || 'Incorrect PIN');
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      {/* Header with Sign Out */}
      <View style={styles.header}>
        <Pressable 
          style={styles.signOutButton}
          onPress={handleSignOut}
          android_ripple={{ color: 'rgba(239, 68, 68, 0.1)' }}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Lock Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={40} color="#6366F1" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Unlock USDCentral</Text>
        <Text style={styles.subtitle}>Enter your 4-digit PIN to continue</Text>

        {/* PIN Dots */}
        <View style={styles.pinDots}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.pinDot,
                index < pin.length && styles.pinDotFilled,
              ]}
            />
          ))}
        </View>

        {/* Error Message */}
        {pinError ? (
          <Text style={styles.errorText}>{pinError}</Text>
        ) : null}

        {/* Number Pad */}
        <View style={styles.keypad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <Pressable
              key={num}
              style={styles.keypadButton}
              onPress={() => {
                if (pinError) setPinError(null);
                clearError();
                if (pin.length < 4) {
                  setPin(pin + num.toString());
                }
              }}
            >
              <Text style={styles.keypadNumber}>{num}</Text>
            </Pressable>
          ))}
          
          <View style={styles.keypadSpacer} />
          
          <Pressable
            style={styles.keypadButton}
            onPress={() => {
              if (pin.length > 0) {
                setPin(pin.slice(0, -1));
              }
            }}
          >
            <Ionicons name="backspace" size={24} color="#6366F1" />
          </Pressable>
          
          <Pressable
            style={styles.keypadButton}
            onPress={() => {
              if (biometricsEnabled) {
                unlockWithBiometrics();
              }
            }}
          >
            <Ionicons name="finger-print" size={24} color="#6366F1" />
          </Pressable>
        </View>

        {/* Unlock Button */}
        <View style={styles.buttonContainer}>
          <Button
            label="Unlock"
            onPress={handlePinUnlock}
            disabled={pin.length !== 4}
            size="lg"
            style={{ height: 58, justifyContent: 'center' }}
          />
        </View>

        {/* Biometrics Button */}
        {/* Removed redundant biometrics button as icon is present in keypad */}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 54, // Reduced from 60
    paddingHorizontal: 24,
    alignItems: 'flex-end',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  signOutText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#EF4444',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginTop: 20, // Reduced from 40
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E0E7FF',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    marginBottom: 40,
  },
  pinDots: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  pinDotFilled: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 280,
    marginBottom: 32,
  },
  keypadButton: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    marginVertical: 6,
  },
  keypadNumber: {
    fontSize: 32,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  keypadSpacer: {
    width: 72,
    height: 72,
    marginHorizontal: 8,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 280,
    marginBottom: 16,
  },
  biometricsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  biometricsText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#6366F1',
  },
});
