import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, StyleSheet, SafeAreaView } from 'react-native';

import { useLiquidityStore } from '@/store/liquidityStore';
import { formatDecimal, formatFromBaseUnits, formatUsdcAmount } from '@/lib/format';

export default function EarnScreen() {
  const {
    isLoading,
    error,
    quote,
    position,
    fetchQuote,
    deposit,
    loadPosition,
    withdraw,
  } = useLiquidityStore();

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    loadPosition().catch(() => undefined);
  }, [loadPosition]);

  const hasPosition = Boolean(position?.status && position.status !== 'EMPTY');
  const canPreview = Boolean(depositAmount.trim()) && !isLoading;
  const canSupply = Boolean(depositAmount.trim()) && !isLoading;
  const canWithdraw = Boolean(withdrawAmount.trim()) && !isLoading;
  const lpDecimals = typeof position?.lpDecimals === 'number' ? position.lpDecimals : null;
  const lpBalanceDisplay =
    position?.lpBalance && lpDecimals != null
      ? formatFromBaseUnits(position.lpBalance, lpDecimals, { maxFraction: 6 })
      : position?.lpBalance ?? '—';
  const usdcValueDisplay = position?.usdcValue
    ? formatUsdcAmount(position.usdcValue)
    : '—';
  const quoteLpDisplay =
    quote?.estimatedLpTokens && lpDecimals != null
      ? formatFromBaseUnits(quote.estimatedLpTokens, lpDecimals, { maxFraction: 6 })
      : quote?.estimatedLpTokens ?? '—';
  const quoteMinLpDisplay =
    quote?.minMintAmount && lpDecimals != null
      ? formatFromBaseUnits(quote.minMintAmount, lpDecimals, { maxFraction: 6 })
      : quote?.minMintAmount ?? '—';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Earn</Text>
          <Text style={styles.subtitle}>Provide USDC liquidity to a stable pool on Arbitrum</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Deposit amount (USDC)</Text>
          <TextInput
            value={depositAmount}
            onChangeText={setDepositAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9AA4B2"
            style={styles.input}
          />

          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => canPreview && fetchQuote(depositAmount)}
              style={[styles.previewButton, !canPreview && styles.buttonDisabled]}
              disabled={!canPreview}
            >
              <Text style={styles.previewButtonText}>Preview</Text>
            </Pressable>
            <Pressable
              onPress={() => canSupply && deposit(depositAmount)}
              style={[styles.supplyButton, !canSupply && styles.buttonDisabled]}
              disabled={!canSupply}
            >
              <Text style={styles.supplyButtonText}>Supply</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#6366F1" />
              <Text style={styles.loadingText}>Working…</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {quote ? (
            <View style={styles.quoteCard}>
              <Text style={styles.quoteTitle}>Quote</Text>
              <Text style={styles.quoteText}>Estimated LP minted: {quoteLpDisplay}</Text>
              <Text style={styles.quoteText}>Min LP after slippage: {quoteMinLpDisplay}</Text>
              <Text style={styles.quoteText}>Slippage: {quote.slippageBps} bps</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your position</Text>
          {!hasPosition ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No active position yet</Text>
            </View>
          ) : (
            <View style={styles.positionCard}>
              <Text style={styles.positionAmount}>{usdcValueDisplay} USDC</Text>
              <Text style={styles.positionDetails}>Status: {position?.status ?? '—'}</Text>
              <Text style={styles.positionDetails}>
                LP balance: {lpBalanceDisplay}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Withdraw amount (USDC)</Text>
          <TextInput
            value={withdrawAmount}
            onChangeText={setWithdrawAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9AA4B2"
            style={styles.input}
          />
          <Pressable
            onPress={() => canWithdraw && withdraw(withdrawAmount)}
            style={[styles.withdrawButton, !canWithdraw && styles.buttonDisabled]}
            disabled={!canWithdraw}
          >
            <Text style={styles.withdrawButtonText}>Withdraw</Text>
          </Pressable>
        </View>

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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 100,
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
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  previewButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  supplyButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  supplyButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  withdrawButton: {
    backgroundColor: '#6366F1',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  withdrawButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    marginLeft: 12,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#EF4444',
    marginTop: 12,
  },
  quoteCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quoteTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
  },
  positionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  positionAmount: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
  },
  positionDetails: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    marginTop: 4,
  },
  bottomPadding: {
    height: 100,
  },
});
