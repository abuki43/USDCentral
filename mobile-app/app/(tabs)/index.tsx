import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';

import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import { firestore } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';

type UnifiedBalanceDoc = {
  usdc?: { amount?: string };
};

type InboundAlertDoc = {
  state?: string;
  blockchain?: string | null;
  amount?: string;
  symbol?: string;
};

export default function TabOneScreen() {
  const { user, logout, isSubmitting } = useAuthStore();
  const [balance, setBalance] = useState<string>('—');
  const [alert, setAlert] = useState<InboundAlertDoc | null>(null);

  useEffect(() => {
    if (!user) return;

    const balanceRef = doc(firestore, 'users', user.uid, 'balances', 'unified');
    const alertRef = doc(firestore, 'users', user.uid, 'alerts', 'inboundUSDC');

    const unsubBalance = onSnapshot(balanceRef, (snap) => {
      const data = (snap.data() as UnifiedBalanceDoc | undefined) ?? undefined;
      setBalance(data?.usdc?.amount ?? '0');
    });

    const unsubAlert = onSnapshot(alertRef, (snap) => {
      setAlert(snap.exists() ? ((snap.data() as InboundAlertDoc) ?? null) : null);
    });

    return () => {
      unsubBalance();
      unsubAlert();
    };
  }, [user]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Total USDC</Text>
        <Text style={styles.amount}>{balance}</Text>

        {alert?.state === 'CONFIRMED' ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Incoming deposit</Text>
            <Text style={styles.bannerBody}>
              {alert.amount ?? '—'} {alert.symbol ?? 'USDC'} on {alert.blockchain ?? 'network'}
              {' '}confirmed. Finalizing…
            </Text>
          </View>
        ) : null}

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
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { width: '100%', gap: 14 },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.6,
  },
  amount: { fontSize: 40, fontWeight: '800' },
  banner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    gap: 4,
  },
  bannerTitle: { fontWeight: '700' },
  bannerBody: { opacity: 0.8 },
});
