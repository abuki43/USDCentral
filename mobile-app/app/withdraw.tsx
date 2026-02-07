import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { backendFetch } from '@/lib/backend';
import { CHAIN_LABELS, type WithdrawChain, WITHDRAW_CHAINS } from '@/lib/chains';
import Button from '@/components/ui/Button';

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
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#6366F1" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Withdraw USDC</Text>
          <Text style={styles.subtitle}>
            Choose a destination chain and address. We'll bridge from Base when needed.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Destination chain</Text>
          <View style={styles.chainContainer}>
            {WITHDRAW_CHAINS.map((chain) => {
              const active = chain === destinationChain;
              return (
                <Pressable
                  key={chain}
                  style={[styles.chainButton, active && styles.chainButtonActive]}
                  onPress={() => setDestinationChain(chain)}
                >
                  <View style={styles.chainRow}>
                    <Text style={[styles.chainName, active && styles.chainNameActive]}>
                      {CHAIN_LABELS[chain]}
                    </Text>
                    {active && (
                      <Ionicons name="checkmark-circle" size={18} color="#6366F1" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Recipient address</Text>
          <TextInput
            value={recipientAddress}
            onChangeText={setRecipientAddress}
            placeholder="0x... or Solana address"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            style={styles.textInput}
          />

          <View style={styles.divider} />

          <Text style={styles.label}>Amount (USDC)</Text>
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.feesHeader}>
            <Ionicons name="wallet-outline" size={20} color="#6366F1" />
            <Text style={styles.feesTitle}>Estimated fees</Text>
          </View>
          
          {isBase ? (
            <Text style={styles.feesText}>
              Direct transfer on Base. Standard network fees apply.
            </Text>
          ) : isEstimating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#6366F1" />
              <Text style={styles.loadingText}>Estimating…</Text>
            </View>
          ) : estimateError ? (
            <Text style={styles.feesText}>
              Estimation unavailable right now.
            </Text>
          ) : providerFee ? (
            <Text style={styles.feesText}>
              Provider fee: {providerFee} USDC
            </Text>
          ) : (
            <Text style={styles.feesText}>No fee estimate yet.</Text>
          )}
        </View>

        {submitError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}

        {submitSuccess ? (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.successText}>{submitSuccess}</Text>
          </View>
        ) : null}

        <Button
          label={isSubmitting ? 'Submitting…' : 'Withdraw'}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
        />

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#6366F1',
    marginLeft: 4,
  },
  header: {
    marginBottom: 24,
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
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  chainContainer: {
    gap: 8,
  },
  chainButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chainButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chainName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  chainNameActive: {
    color: '#6366F1',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 20,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  currencySymbol: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#6366F1',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  feesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  feesTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
    marginLeft: 10,
  },
  feesText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    marginLeft: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#EF4444',
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 16,
  },
  successText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#10B981',
    flex: 1,
  },
  bottomPadding: {
    height: 100,
  },
});
