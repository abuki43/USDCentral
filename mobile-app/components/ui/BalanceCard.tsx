import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type BalanceCardProps = {
  balance: string;
  symbol?: string;
  onHideToggle?: () => void;
  hidden?: boolean;
};

export default function BalanceCard({ 
  balance, 
  symbol = 'USDC',
  onHideToggle,
  hidden = false,
}: BalanceCardProps) {
  const [isHidden, setIsHidden] = useState(hidden);

  const toggleHide = () => {
    setIsHidden(!isHidden);
    onHideToggle?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.currencyBadge}>
            <View style={styles.currencyIcon}>
              <Text style={styles.currencyIconText}>$</Text>
            </View>
            <Text style={styles.currencySymbol}>{symbol}</Text>
          </View>
          <Pressable onPress={toggleHide} style={styles.visibilityButton}>
            <Ionicons
              name={isHidden ? 'eye-off' : 'eye'}
              size={20}
              color="#64748B"
            />
          </Pressable>
        </View>

        <View style={styles.balanceContainer}>
          <Text style={styles.currencyLabel}>Total Balance</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.currencySign}>$</Text>
            <Text style={styles.balance}>
              {isHidden ? '••••••' : balance}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.glowEffect} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  glowEffect: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: 32,
    zIndex: -1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  currencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  currencySymbol: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  visibilityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceContainer: {
    marginBottom: 0,
  },
  currencyLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  currencySign: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
    lineHeight: 36,
  },
  balance: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
    lineHeight: 44,
    letterSpacing: -1,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  networkText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
  },
});
