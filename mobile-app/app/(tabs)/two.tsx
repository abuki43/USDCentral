import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';

import { Text } from '@/components/Themed';
import { firestore } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';

type UserDoc = {
  circle?: {
    evmAddress?: string | null;
    solAddress?: string | null;
  };
};

export default function DepositScreen() {
  const { user } = useAuthStore();
  const [evm, setEvm] = useState<string | null>(null);
  const [sol, setSol] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const ref = doc(firestore, 'users', user.uid);
    return onSnapshot(ref, (snap) => {
      const data = snap.data() as UserDoc | undefined;
      setEvm(data?.circle?.evmAddress ?? null);
      setSol(data?.circle?.solAddress ?? null);
    });
  }, [user]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Deposit</Text>
      <Text style={styles.subtitle}>
        EVM chains share one address. Solana has its own address.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EVM deposit address</Text>
        <Text style={styles.mono}>{evm ?? 'Setting up…'}</Text>
        <Text style={styles.helper}>
          Use on: Ethereum Sepolia, Polygon Amoy, Arbitrum Sepolia, OP Sepolia, Base Sepolia
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Solana (Devnet) deposit address</Text>
        <Text style={styles.mono}>{sol ?? 'Setting up…'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { opacity: 0.7 },
  section: { gap: 8, paddingTop: 12 },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.6,
  },
  mono: { fontSize: 14 },
  helper: { fontSize: 12, opacity: 0.7 },
});
