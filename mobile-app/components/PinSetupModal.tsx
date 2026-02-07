import { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  Text,
  View,
  StyleSheet,
} from 'react-native';

import { useLocalAuthStore } from '@/store/localAuthStore';

type PinSetupModalProps = {
  visible: boolean;
  onClose: () => void;
  mode: 'create' | 'change';
};

type PinStep = 'current' | 'new' | 'confirm';

export default function PinSetupModal({ visible, onClose, mode }: PinSetupModalProps) {
  const { setPin, unlockWithPin, clearError, errorMessage } = useLocalAuthStore();
  const [step, setStep] = useState<PinStep>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const translateY = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep(mode === 'change' ? 'current' : 'new');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setLocalError(null);
      clearError();
      
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 400,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleNumberPress = (num: string) => {
    if (localError) setLocalError(null);
    clearError();

    if (step === 'current') {
      if (currentPin.length < 4) {
        const updated = currentPin + num;
        setCurrentPin(updated);
        if (updated.length === 4) {
          validateCurrentPin(updated);
        }
      }
    } else if (step === 'new') {
      if (newPin.length < 4) {
        const updated = newPin + num;
        setNewPin(updated);
        if (updated.length === 4) {
          setTimeout(() => setStep('confirm'), 150);
        }
      }
    } else if (step === 'confirm') {
      if (confirmPin.length < 4) {
        const updated = confirmPin + num;
        setConfirmPin(updated);
        if (updated.length === 4) {
          validateAndSetPin(updated);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (step === 'current' && currentPin.length > 0) {
      setCurrentPin(currentPin.slice(0, -1));
    } else if (step === 'new' && newPin.length > 0) {
      setNewPin(newPin.slice(0, -1));
    } else if (step === 'confirm' && confirmPin.length > 0) {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const validateCurrentPin = async (pin: string) => {
    const success = await unlockWithPin(pin);
    if (success) {
      setTimeout(() => {
        setCurrentPin('');
        setStep('new');
      }, 200);
    } else {
      setTimeout(() => {
        setCurrentPin('');
        setLocalError('Incorrect PIN');
      }, 200);
    }
  };

  const validateAndSetPin = async (pin: string) => {
    if (pin !== newPin) {
      setTimeout(() => {
        setConfirmPin('');
        setLocalError('PINs do not match');
      }, 200);
      return;
    }

    const success = await setPin(pin);
    if (success) {
      onClose();
    } else {
      setTimeout(() => {
        setConfirmPin('');
        setLocalError('Failed to save PIN');
      }, 200);
    }
  };

  const getCurrentPin = () => {
    if (step === 'current') return currentPin;
    if (step === 'new') return newPin;
    if (step === 'confirm') return confirmPin;
    return '';
  };

  const getTitle = () => {
    if (step === 'current') return 'Enter Current PIN';
    if (step === 'new') return 'Create New PIN';
    if (step === 'confirm') return 'Confirm New PIN';
    return '';
  };

  const getSubtitle = () => {
    if (step === 'current') return 'Enter your current PIN to continue';
    if (step === 'new') return 'Enter a new 4-digit PIN';
    if (step === 'confirm') return 'Re-enter to confirm';
    return '';
  };

  const displayError = localError || errorMessage;
  const pinLength = getCurrentPin().length;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity }]} />
        <Animated.View style={[styles.modalWrapper, { opacity, transform: [{ translateY }] }]}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            
            <Text style={styles.title}>{getTitle()}</Text>
            <Text style={styles.subtitle}>{getSubtitle()}</Text>
            
            <View style={styles.pinDisplay}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.pinDot,
                    i < pinLength && styles.pinDotFilled,
                  ]}
                />
              ))}
            </View>
            
            {displayError ? (
              <Text style={styles.error}>{displayError}</Text>
            ) : null}
            
            <View style={styles.keypad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <Pressable
                  key={num}
                  style={styles.key}
                  onPress={() => handleNumberPress(num.toString())}
                >
                  <Text style={styles.keyNum}>{num}</Text>
                </Pressable>
              ))}
              
              <View style={styles.keySpacer} />
              
              <Pressable
                style={styles.key}
                onPress={() => handleNumberPress('0')}
              >
                <Text style={styles.keyNum}>0</Text>
              </Pressable>
              
              <Pressable style={styles.key} onPress={handleBackspace}>
                <Text style={styles.backspace}>⌫</Text>
              </Pressable>
            </View>
            
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingTop: 16,
    paddingHorizontal: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B1220',
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 15,
    color: '#4A5568',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    fontFamily: 'Inter_400Regular',
  },
  pinDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F7F9FC',
  },
  pinDotFilled: {
    backgroundColor: '#2E86F5',
    borderColor: '#2E86F5',
  },
  error: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Inter_400Regular',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  key: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 6,
  },
  keyNum: {
    fontSize: 28,
    fontWeight: '600',
    color: '#0B1220',
    fontFamily: 'Inter_600SemiBold',
  },
  keySpacer: {
    width: 64,
    height: 64,
    marginHorizontal: 8,
  },
  backspace: {
    fontSize: 22,
    color: '#4A5568',
  },
  cancel: {
    padding: 16,
    marginTop: 16,
  },
  cancelText: {
    color: '#4A5568',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
});
