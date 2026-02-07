import { useState } from 'react';
import { Pressable, Switch, Text, View, StyleSheet } from 'react-native';

import { useLocalAuthStore } from '@/store/localAuthStore';
import PinSetupModal from '@/components/PinSetupModal';

export default function LocalAuthSection() {
  const {
    isEnabled,
    biometricsSupported,
    biometricsEnabled,
    pinSet,
    enableLocalAuth,
    disableLocalAuth,
    setBiometricsEnabled,
    lock,
  } = useLocalAuthStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);

  const handleToggleLocalAuth = async (value: boolean) => {
    if (value) {
      if (!pinSet) {
        setShowCreateModal(true);
        return;
      }
      await enableLocalAuth();
    } else {
      await disableLocalAuth();
    }
  };

  const handleChangePin = () => {
    setShowChangeModal(true);
  };

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>Local Sign-In</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Enable local sign-in</Text>
          <Switch
            value={isEnabled}
            onValueChange={handleToggleLocalAuth}
            trackColor={{ false: '#E2E8F0', true: '#2E86F5' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {isEnabled && (
          <>
            {biometricsSupported ? (
              <View style={styles.row}>
                <Text style={styles.label}>Use fingerprint / Face ID</Text>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={(value) => setBiometricsEnabled(value)}
                  trackColor={{ false: '#E2E8F0', true: '#2E86F5' }}
                  thumbColor="#FFFFFF"
                  disabled={!isEnabled}
                />
              </View>
            ) : null}

            <View style={styles.buttonRow}>
              <Pressable style={styles.button} onPress={handleChangePin}>
                <Text style={styles.buttonIcon}>🔑</Text>
                <Text style={styles.buttonText}>Change PIN</Text>
              </Pressable>

              <Pressable style={styles.button} onPress={lock}>
                <Text style={styles.buttonIcon}>🔒</Text>
                <Text style={styles.buttonText}>Lock now</Text>
              </Pressable>
            </View>
          </>
        )}

        {!biometricsSupported && isEnabled ? (
          <Text style={styles.note}>
            Biometrics are not available on this device.
          </Text>
        ) : null}
      </View>

      <PinSetupModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mode="create"
      />

      <PinSetupModal
        visible={showChangeModal}
        onClose={() => setShowChangeModal(false)}
        mode="change"
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F7F9FC',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A5568',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Inter_500Medium',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  label: {
    fontSize: 16,
    color: '#0B1220',
    fontFamily: 'Inter_400Regular',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  buttonIcon: {
    fontSize: 16,
  },
  buttonText: {
    fontSize: 14,
    color: '#0B1220',
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  note: {
    fontSize: 14,
    color: '#4A5568',
    fontStyle: 'italic',
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
  },
});
