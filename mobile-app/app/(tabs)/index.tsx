import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';

import { backendFetch } from '@/lib/backend';
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

type CircleTransaction = {
  id: string;
  blockchain: string;
  state: string;
  createDate: string;
  updateDate?: string;
  txHash?: string;
  transactionType?: 'INBOUND' | 'OUTBOUND';
  txType?: 'INBOUND' | 'OUTBOUND';
  amounts?: string[];
  sourceAddress?: string;
  destinationAddress?: string;
};

export default function TabOneScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [balance, setBalance] = useState<string>('—');
  const [alert, setAlert] = useState<InboundAlertDoc | null>(null);
  const [transactions, setTransactions] = useState<CircleTransaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    setIsLoadingTx(true);
    setTxError(null);
    backendFetch('/circle/transactions?pageSize=20&order=DESC')
      .then((data: { transactions?: CircleTransaction[] }) => {
        if (cancelled) return;
        setTransactions(data.transactions ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setTxError(e instanceof Error ? e.message : 'Failed to load transactions');
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingTx(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <ScrollView className="flex-1 bg-surface-0">
      <View className="px-6 pt-6 pb-10">
        <Text className="text-xs text-ink-500 font-sans-medium tracking-widest uppercase">
          Total USDC
        </Text>
        <Text className="text-4xl text-ink-900 font-sans-bold mt-2">{balance}</Text>

        <View className="mt-5 flex-row gap-3">
          <Pressable
            className="flex-1 items-center justify-center rounded-2xl bg-primary-600 py-3 active:opacity-90"
            onPress={() => router.push('/withdraw')}
          >
            <Text className="text-sm font-sans-semibold text-white">Withdraw</Text>
          </Pressable>
          <Pressable
            className="flex-1 items-center justify-center rounded-2xl border border-stroke-100 bg-surface-1 py-3 active:opacity-90"
            onPress={() => router.push('/send')}
          >
            <Text className="text-sm font-sans-semibold text-ink-700">Send</Text>
          </Pressable>
          <View className="flex-1 items-center justify-center rounded-2xl border border-stroke-100 bg-surface-1 py-3">
            <Text className="text-sm font-sans-semibold text-ink-700">Deposit</Text>
          </View>
        </View>

        {alert?.state === 'CONFIRMED' ? (
          <View className="mt-5 bg-primary-50 border border-primary-100 rounded-3xl p-4">
            <Text className="text-ink-900 font-sans-semibold">Incoming deposit</Text>
            <Text className="text-ink-700 font-sans mt-1">
              {alert.amount ?? '—'} {alert.symbol ?? 'USDC'} on {alert.blockchain ?? 'network'} confirmed.
              {' '}Finalizing…
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-6 bg-surface-1 border border-stroke-100 rounded-3xl p-5">
        <Text className="text-xs text-ink-500 font-sans-medium tracking-widest uppercase">
          Recent activity
        </Text>

        {isLoadingTx ? (
          <View className="flex-row items-center mt-4">
            <ActivityIndicator />
            <Text className="ml-3 text-ink-500 font-sans">Loading…</Text>
          </View>
        ) : txError ? (
          <Text className="mt-4 text-danger-500 font-sans">{txError}</Text>
        ) : transactions.length === 0 ? (
          <Text className="mt-4 text-ink-500 font-sans">No transactions yet.</Text>
        ) : (
          <View className="mt-4">
            {transactions.slice(0, 10).map((tx, index) => {
              const txType = tx.transactionType ?? tx.txType;
              const direction = txType === 'INBOUND' ? 'Received' : 'Sent';
              const sign = txType === 'INBOUND' ? '+' : '-';
              const amount = tx.amounts?.[0];
              const when = tx.createDate ? new Date(tx.createDate).toLocaleString() : '';

              return (
                <View
                  key={tx.id}
                  className={index === 0 ? 'pt-0' : 'pt-4 border-t border-stroke-100'}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-4">
                      <Text className="text-base text-ink-900 font-sans-semibold">
                        {direction}
                      </Text>
                      <Text className="text-xs text-ink-500 font-sans mt-1">
                        {tx.blockchain} • {tx.state}
                      </Text>
                      {when ? (
                        <Text className="text-xs text-ink-500 font-sans mt-1">{when}</Text>
                      ) : null}
                    </View>

                    <View>
                      <Text className="text-base text-ink-900 font-sans-semibold">
                        {amount ? `${sign}${amount}` : '—'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
