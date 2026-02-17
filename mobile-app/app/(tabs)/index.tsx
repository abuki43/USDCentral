import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, doc, limit, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { firestore } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import BalanceCard from '@/components/ui/BalanceCard';
import ActionButtons from '@/components/ui/ActionButtons';
import AlertCard from '@/components/ui/AlertCard';
import TransactionItem from '@/components/ui/TransactionItem';

type UnifiedBalanceDoc = {
  usdc?: { amount?: string };
};

type InboundAlertDoc = {
  txId?: string;
  state?: string;
  blockchain?: string | null;
  amount?: string;
  symbol?: string;
  updatedAt?: Timestamp | string | null;
};

type InboundTokenAlert = {
  txId: string;
  amount?: string;
  symbol?: string | null;
  blockchain?: string | null;
};

type FinalizedTokenAlert = {
  originTxId: string;
  amount?: string;
  symbol?: string | null;
  destinationChain?: string | null;
  sourceChain?: string | null;
};

type DisplayAlert = {
  type: 'success' | 'info';
  title: string;
  message: string;
  duration: number;
};

type UnifiedTransaction = {
  id: string;
  kind: 'DEPOSIT' | 'WITHDRAW' | 'SEND' | 'RECEIVE' | 'SWAP' | 'BRIDGE' | 'EARN';
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'FAILED' | 'BRIDGING';
  amount?: string;
  symbol?: string | null;
  blockchain?: string | null;
  sourceChain?: string | null;
  destinationChain?: string | null;
  txHash?: string | null;
  relatedTxId?: string | null;
  metadata?: Record<string, any> | null;
  createdAt?: Timestamp | string | null;
  updatedAt?: Timestamp | string | null;
};

const HUB_CHAIN = 'ARB-SEPOLIA';

export default function TabOneScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [balance, setBalance] = useState<string>('0.00');
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [alert, setAlert] = useState<InboundAlertDoc | null>(null);
  const [incomingAlert, setIncomingAlert] = useState<InboundTokenAlert | null>(null);
  const [finalizedAlert, setFinalizedAlert] = useState<FinalizedTokenAlert | null>(null);
  const [displayAlert, setDisplayAlert] = useState<DisplayAlert | null>(null);
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const lastIncomingTxIdRef = useRef<string | null>(null);
  const lastFinalizedOriginRef = useRef<string | null>(null);
  const lastAlertKeyRef = useRef<string | null>(null);

  const sortedTransactions = useMemo(() => {
    const toMillis = (value?: Timestamp | string | null) => {
      if (value instanceof Timestamp) return value.toMillis();
      if (typeof value === 'string') return new Date(value).getTime();
      return 0;
    };

    const isFinalHubDeposit = (tx: UnifiedTransaction) => {
      if (tx.kind !== 'DEPOSIT') return true;
      const blockchain = tx.blockchain ?? null;
      const source = tx.sourceChain ?? null;
      if (source && source !== HUB_CHAIN) return false;
      return blockchain === HUB_CHAIN;
    };

    const earnActions = new Set(['ADD_LIQUIDITY', 'WITHDRAW_LIQUIDITY']);

    const isVisibleEarn = (tx: UnifiedTransaction) => {
      if (tx.kind !== 'EARN') return true;
      const action = tx.metadata?.action as string | undefined;
      return Boolean(action && earnActions.has(action));
    };

    return [...transactions]
      .filter((tx) => tx.kind !== 'BRIDGE')
      .filter(isFinalHubDeposit)
      .filter(isVisibleEarn)
      .sort((a, b) => {
        const aTime = toMillis(a.updatedAt ?? a.createdAt);
        const bTime = toMillis(b.updatedAt ?? b.createdAt);
        return bTime - aTime;
      });
  }, [transactions]);

  useEffect(() => {
    if (!user) return;

    const balanceRef = doc(firestore, 'users', user.uid, 'balances', 'unified');
    const alertRef = doc(firestore, 'users', user.uid, 'alerts', 'inboundUSDC');
    const unsubBalance = onSnapshot(balanceRef, (snap) => {
      const data = (snap.data() as UnifiedBalanceDoc | undefined) ?? undefined;
      setBalance(data?.usdc?.amount ?? '0.00');
    });

    const unsubAlert = onSnapshot(alertRef, (snap) => {
      setAlert(snap.exists() ? ((snap.data() as InboundAlertDoc) ?? null) : null);
    });

    return () => {
      unsubBalance();
      unsubAlert();
    };
  }, [user]);

  useEffect(() => {
    if (!alert?.state) return;
    const key = [alert.txId ?? 'no-tx', alert.state ?? 'no-state'].join(':');
    if (lastAlertKeyRef.current === key) return;
    lastAlertKeyRef.current = key;

    if (alert.state === 'CONFIRMED') {
      setDisplayAlert({
        type: 'info',
        title: 'Incoming deposit',
        message: `${alert.amount ?? '—'} ${alert.symbol ?? 'USDC'} on ${alert.blockchain ?? 'network'} confirmed. Finalizing…`,
        duration: 6000,
      });
    }

    if (alert.state === 'BRIDGED' || alert.state === 'COMPLETED') {
      setDisplayAlert({
        type: 'success',
        title: 'Funds finalized',
        message: `${alert.amount ?? '—'} ${alert.symbol ?? 'USDC'} finalized on ${alert.blockchain ?? 'network'}.`,
        duration: 8000,
      });
    }
  }, [alert]);

  useEffect(() => {
    if (!incomingAlert?.txId) return;
    if (incomingAlert.txId === lastIncomingTxIdRef.current) return;
    
    lastIncomingTxIdRef.current = incomingAlert.txId;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [incomingAlert?.txId]);

  useEffect(() => {
    if (!finalizedAlert?.originTxId) return;
    if (finalizedAlert.originTxId === lastFinalizedOriginRef.current) return;
    
    lastFinalizedOriginRef.current = finalizedAlert.originTxId;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [finalizedAlert?.originTxId]);

  useEffect(() => {
    if (!user) return;

    setIsLoadingTx(true);
    setTxError(null);

    const txRef = collection(firestore, 'users', user.uid, 'transactions');
    const txQuery = query(txRef, orderBy('updatedAt', 'desc'), limit(20));

    const unsubscribe = onSnapshot(
      txQuery,
      (snap) => {
        const items = snap.docs.map((doc) => {
          const data = doc.data() as UnifiedTransaction;
          return { ...data, id: doc.id };
        });
        setTransactions(items);
        setIsLoadingTx(false);
      },
      (error) => {
        setTxError(error?.message ?? 'Failed to load transactions');
        setIsLoadingTx(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  const stats: { label: string; value: string; icon: any; color: string }[] = [
    { label: 'APY', value: '5.2%', icon: 'trending-up', color: '#10B981' },
    { label: 'Pool TVL', value: '$2.4M', icon: 'wallet', color: '#6366F1' },
    { label: 'Your Earned', value: '$12.34', icon: 'gift', color: '#F59E0B' },
  ];

  const recentTransactions = sortedTransactions.slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userGreeting}>
            <Text style={styles.greeting}>Good evening</Text>
            <Text style={styles.userName}>{user?.displayName?.split(' ')[0] || 'User'}</Text>
          </View>
          <Pressable 
            style={styles.infoButton}
            onPress={() => router.push('/learn' as any)}
            android_ripple={{ color: 'rgba(99, 102, 241, 0.1)' }}
          >
            <Ionicons name="help-circle-outline" size={24} color="#0F172A" />
          </Pressable>
        </View>

        {/* Balance Card */}
        <BalanceCard 
          balance={balance}
          symbol="USDC"
          hidden={isBalanceHidden}
          onHideToggle={() => setIsBalanceHidden((prev) => !prev)}
        />

        {/* Action Buttons */}
        <ActionButtons />


        {/* Alerts */}
        {(displayAlert || incomingAlert || finalizedAlert) && (
          <View style={styles.section}>
            {displayAlert && (
              <AlertCard
                type={displayAlert.type}
                title={displayAlert.title}
                message={displayAlert.message}
                autoDismiss
                duration={displayAlert.duration}
                onDismiss={() => setDisplayAlert(null)}
              />
            )}
            {incomingAlert?.txId && (
              <AlertCard
                type="success"
                title="Token received"
                message={`${incomingAlert.amount ?? '—'} ${incomingAlert.symbol ?? 'token'} on ${incomingAlert.blockchain ?? 'network'} detected.`}
                autoDismiss
                duration={6000}
              />
            )}
            {finalizedAlert?.originTxId && (
              <AlertCard
                type="success"
                title="Funds finalized"
                message={`${finalizedAlert.amount ?? '—'} ${finalizedAlert.symbol ?? 'USDC'} finalized on ${finalizedAlert.destinationChain ?? finalizedAlert.sourceChain ?? 'network'}.`}
                autoDismiss
                duration={8000}
              />
            )}
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
          </View>

          {isLoadingTx ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#6366F1" />
              <Text style={styles.loadingText}>Loading transactions…</Text>
            </View>
          ) : txError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={24} color="#EF4444" />
              <Text style={styles.errorText}>{txError}</Text>
            </View>
          ) : recentTransactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptySubtitle}>Your recent activity will appear here</Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {recentTransactions.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  id={tx.id}
                  type={tx.kind}
                  amount={tx.amount ?? '0'}
                  symbol={tx.symbol ?? 'USDC'}
                  status={tx.status}
                  hideAmount={isBalanceHidden}
                  timestamp={
                    tx.createdAt instanceof Timestamp
                      ? tx.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : typeof tx.createdAt === 'string'
                        ? new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '—'
                  }
                />
              ))}
            </View>
          )}
        </View>

        {/* Bottom padding for floating dock */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  userGreeting: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
    marginBottom: 2,
  },
  userName: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
  },
  infoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    marginTop: 12,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#EF4444',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600Semibold',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
  },
  transactionsList: {
    gap: 8,
  },
  bottomPadding: {
    height: 120,
  },
});
