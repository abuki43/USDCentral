import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { backendFetch } from '@/lib/backend';
import { CHAIN_LABELS, type WithdrawChain, WITHDRAW_CHAINS } from '@/lib/chains';

const BASE_CHAIN: WithdrawChain = 'BASE-SEPOLIA';

type BridgeEstimate = {
  fees?: { type?: string; amount?: string }[];
};

export default function WithdrawScreen() {
  const router = useRouter();
  const [destinationChain, setDestinationChain] = useState<WithdrawChain>(BASE_CHAIN);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<BridgeEstimate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const isBase = destinationChain === BASE_CHAIN;

  useEffect(() => {
    setEstimate(null);
    setEstimateError(null);

    if (isBase) return;
    if (!amount || !recipientAddress) return;

    const timeout = setTimeout(() => {
      setIsEstimating(true);
      backendFetch('/bridge/estimate', {
        method: 'POST',
        body: JSON.stringify({
          destinationChain,
          recipientAddress,
          amount,
        }),
      })
        .then((data: { estimate?: BridgeEstimate | null }) => {
          setEstimate(data.estimate ?? null);
        })
        .catch((err: unknown) => {
          setEstimateError(err instanceof Error ? err.message : 'Failed to estimate fees');
        })
        .finally(() => setIsEstimating(false));
    }, 400);

    return () => clearTimeout(timeout);
  }, [amount, destinationChain, recipientAddress, isBase]);

  const providerFee = useMemo(() => {
    if (!estimate?.fees) return null;
    return estimate.fees.find((fee) => fee.type === 'provider')?.amount ?? null;
  }, [estimate]);

  const canSubmit = Boolean(amount && recipientAddress && destinationChain && !isSubmitting);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);

    try {
      await backendFetch('/bridge/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          destinationChain,
          recipientAddress,
          amount,
        }),
      });
      setSubmitSuccess('Withdrawal initiated.');
      setAmount('');
      setRecipientAddress('');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Withdraw failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-surface-0">
      <Stack.Screen options={{ title: 'Withdraw' }} />
      <View className="px-6 pt-6 pb-12">
        <Pressable onPress={() => router.back()} className="mb-4">
          <Text className="text-sm font-sans-semibold text-primary-600">Back</Text>
        </Pressable>

        <Text className="text-2xl font-sans-bold text-ink-900">Withdraw USDC</Text>
        <Text className="mt-2 text-sm font-sans text-ink-500">
          Choose a destination chain and address. We’ll bridge from Base when needed.
        </Text>

        <View className="mt-6 rounded-3xl border border-stroke-100 bg-surface-1 p-5">
          <Text className="text-xs font-sans-medium uppercase tracking-widest text-ink-500">
            Destination chain
          </Text>
          <View className="mt-3">
            {WITHDRAW_CHAINS.map((chain) => {
              const active = chain === destinationChain;
              return (
                <Pressable
                  key={chain}
                  onPress={() => setDestinationChain(chain)}
                  className={`mb-2 flex-row items-center justify-between rounded-2xl border px-4 py-3 ${
                    active
                      ? 'border-primary-200 bg-primary-50'
                      : 'border-stroke-100 bg-white'
                  }`}
                >
                  <Text className={`text-sm font-sans-semibold ${active ? 'text-primary-700' : 'text-ink-700'}`}>
                    {CHAIN_LABELS[chain]}
                  </Text>
                  {active ? <Text className="text-xs font-sans text-primary-700">Selected</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mt-6 rounded-3xl border border-stroke-100 bg-surface-1 p-5">
          <Text className="text-xs font-sans-medium uppercase tracking-widest text-ink-500">
            Recipient address
          </Text>
          <TextInput
            value={recipientAddress}
            onChangeText={setRecipientAddress}
            placeholder="0x... or Solana address"
            placeholderTextColor="#9AA4B2"
            autoCapitalize="none"
            className="mt-3 rounded-2xl border border-stroke-100 bg-white px-4 py-3 text-sm font-sans text-ink-900"
          />

          <Text className="mt-5 text-xs font-sans-medium uppercase tracking-widest text-ink-500">
            Amount (USDC)
          </Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9AA4B2"
            className="mt-3 rounded-2xl border border-stroke-100 bg-white px-4 py-3 text-sm font-sans text-ink-900"
          />
        </View>

        <View className="mt-6 rounded-3xl border border-stroke-100 bg-surface-1 p-5">
          <Text className="text-xs font-sans-medium uppercase tracking-widest text-ink-500">
            Estimated fees
          </Text>
          {isBase ? (
            <Text className="mt-3 text-sm font-sans text-ink-700">
              Direct transfer on Base. Standard network fees apply.
            </Text>
          ) : isEstimating ? (
            <View className="mt-3 flex-row items-center">
              <ActivityIndicator />
              <Text className="ml-3 text-sm font-sans text-ink-500">Estimating…</Text>
            </View>
          ) : estimateError ? (
            <Text className="mt-3 text-sm font-sans text-ink-500">
              Estimation unavailable right now.
            </Text>
          ) : providerFee ? (
            <Text className="mt-3 text-sm font-sans text-ink-700">
              Provider fee: {providerFee} USDC
            </Text>
          ) : (
            <Text className="mt-3 text-sm font-sans text-ink-500">No fee estimate yet.</Text>
          )}
        </View>

        {submitError ? (
          <Text className="mt-4 text-sm font-sans text-danger-500">{submitError}</Text>
        ) : null}
        {submitSuccess ? (
          <Text className="mt-4 text-sm font-sans text-success-500">{submitSuccess}</Text>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          className={`mt-6 rounded-2xl py-4 ${
            canSubmit ? 'bg-primary-600' : 'bg-stroke-100'
          }`}
        >
          <Text className={`text-center text-sm font-sans-semibold ${canSubmit ? 'text-white' : 'text-ink-300'}`}>
            {isSubmitting ? 'Submitting…' : 'Withdraw'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
