import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Pressable, Text, View } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';

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
  const [copied, setCopied] = useState<'evm' | 'sol' | null>(null);

  useEffect(() => {
    if (!user) return;
    const ref = doc(firestore, 'users', user.uid);
    return onSnapshot(ref, (snap) => {
      const data = snap.data() as UserDoc | undefined;
      setEvm(data?.circle?.evmAddress ?? null);
      setSol(data?.circle?.solAddress ?? null);
    });
  }, [user]);

  const copy = async (value: string, which: 'evm' | 'sol') => {
    await Clipboard.setStringAsync(value);
    setCopied(which);
    setTimeout(() => setCopied((current) => (current === which ? null : current)), 1200);
  };

  return (
    <View className="flex-1 bg-surface-0 px-6 pt-6">
      <View className="mb-4">
        <Text className="text-2xl text-ink-900 font-sans-bold">Deposit</Text>
        <Text className="text-base text-ink-500 font-sans mt-1">
          EVM chains share one address. Solana has its own.
        </Text>
      </View>

      <View className="bg-surface-1 border border-stroke-100 rounded-3xl p-5 mb-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-ink-500 font-sans-medium tracking-widest uppercase">
            EVM deposit address
          </Text>

          {evm ? (
            <Pressable
              onPress={() => copy(evm, 'evm')}
              className="px-3 py-1.5 rounded-full bg-primary-50 border border-primary-100"
            >
              <Text className="text-primary-700 font-sans-semibold text-xs">
                {copied === 'evm' ? 'Copied' : 'Copy'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text className="font-mono text-ink-900 mt-3">
          {evm ?? 'Setting up…'}
        </Text>
        <Text className="text-sm text-ink-500 font-sans mt-3">
          Use on: Ethereum Sepolia, Polygon Amoy, Arbitrum Sepolia, OP Sepolia, Base Sepolia
        </Text>
      </View>

      <View className="bg-surface-1 border border-stroke-100 rounded-3xl p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-ink-500 font-sans-medium tracking-widest uppercase">
            Solana (Devnet) deposit address
          </Text>

          {sol ? (
            <Pressable
              onPress={() => copy(sol, 'sol')}
              className="px-3 py-1.5 rounded-full bg-primary-50 border border-primary-100"
            >
              <Text className="text-primary-700 font-sans-semibold text-xs">
                {copied === 'sol' ? 'Copied' : 'Copy'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text className="font-mono text-ink-900 mt-3">
          {sol ?? 'Setting up…'}
        </Text>
      </View>
    </View>
  );
}
