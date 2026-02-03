import { StyleSheet, View } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import { useAuthStore } from '@/store/authStore';

export default function TabOneScreen() {
  const { user, logout, isSubmitting } = useAuthStore();
  const displayName = user?.displayName || 'Welcome back';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{displayName}</Text>
        <Text style={styles.subtitle}>Your USDCentral account is ready.</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Email</Text>
          <Text style={styles.detailValue}>{user?.email ?? '—'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>UID</Text>
          <Text style={styles.detailValue}>{user?.uid ?? '—'}</Text>
        </View>

        <PrimaryButton
          label={isSubmitting ? 'Signing out...' : 'Sign out'}
          onPress={logout}
          disabled={isSubmitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    opacity: 0.7,
  },
  detailRow: {
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.6,
  },
  detailValue: {
    fontSize: 14,
  },
});
