import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, StyleSheet, SafeAreaView } from 'react-native';

import { useLiquidityStore, type RangePreset } from '@/store/liquidityStore';

export default function EarnScreen() {
  const {
    isLoading,
    error,
    quote,
    positions,
    fetchQuote,
    createPosition,
    loadPositions,
    collectFees,
    withdrawPosition,
  } = useLiquidityStore();

  const [amount, setAmount] = useState('');
  const preset: RangePreset = 'balanced';

  useEffect(() => {
    loadPositions().catch(() => undefined);
  }, [loadPositions]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Earn</Text>
          <Text style={styles.subtitle}>Provide USDC liquidity to a stable pool on Base</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Amount (USDC)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9AA4B2"
            style={styles.input}
          />

          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => amount && fetchQuote(amount, preset)}
              style={styles.previewButton}
            >
              <Text style={styles.previewButtonText}>Preview</Text>
            </Pressable>
            <Pressable
              onPress={() => amount && createPosition(amount, preset)}
              style={styles.supplyButton}
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
              <Text style={styles.quoteText}>Pool: {quote.token0} / {quote.token1}</Text>
              <Text style={styles.quoteText}>Fee tier: {quote.fee} bps</Text>
              <Text style={styles.quoteText}>Amount: {quote.amount} USDC</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your positions</Text>
          {positions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No positions yet</Text>
            </View>
          ) : (
            <View style={styles.positionsList}>
              {positions.map((position) => (
                <View key={position.id} style={styles.positionCard}>
                  <Text style={styles.positionAmount}>
                    {position.amount ?? '—'} USDC
                  </Text>
                  <Text style={styles.positionDetails}>
                    Range: {position.rangePreset ?? '—'} • Status: {position.status ?? '—'}
                  </Text>

                  <View style={styles.positionButtons}>
                    <Pressable
                      onPress={() => collectFees(position.id)}
                      style={styles.collectButton}
                    >
                      <Text style={styles.collectButtonText}>Collect</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => withdrawPosition(position.id)}
                      style={styles.withdrawButton}
                    >
                      <Text style={styles.withdrawButtonText}>Withdraw</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
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
  presetsContainer: {
    gap: 8,
    marginBottom: 20,
  },
  presetButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  presetLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  presetLabelActive: {
    color: '#6366F1',
  },
  presetHelper: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    marginTop: 4,
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
  positionsList: {
    gap: 12,
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
    marginBottom: 16,
  },
  positionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  collectButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  collectButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  withdrawButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  withdrawButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  bottomPadding: {
    height: 100,
  },
});
