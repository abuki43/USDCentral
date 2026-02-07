import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

type TransactionType = 'DEPOSIT' | 'WITHDRAW' | 'SEND' | 'RECEIVE' | 'SWAP' | 'BRIDGE' | 'EARN';

type TransactionItemProps = {
  id: string;
  type: TransactionType;
  amount: string;
  symbol?: string;
  destination?: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'FAILED' | 'BRIDGING';
  timestamp: string;
  onPress?: () => void;
};

const TYPE_CONFIG: Record<TransactionType, { icon: any; color: string; label: string }> = {
  DEPOSIT: { icon: 'arrow-down-circle', color: '#10B981', label: 'Deposit' },
  WITHDRAW: { icon: 'arrow-up-circle', color: '#F59E0B', label: 'Withdraw' },
  SEND: { icon: 'send', color: '#6366F1', label: 'Sent' },
  RECEIVE: { icon: 'arrow-down-circle', color: '#10B981', label: 'Received' },
  SWAP: { icon: 'swap-horizontal', color: '#8B5CF6', label: 'Swap' },
  BRIDGE: { icon: 'link', color: '#EC4899', label: 'Bridge' },
  EARN: { icon: 'trending-up', color: '#14B8A6', label: 'Earn' },
};

const STATUS_CONFIG = {
  PENDING: { color: '#F59E0B', label: 'Pending' },
  CONFIRMED: { color: '#6366F1', label: 'Confirmed' },
  COMPLETED: { color: '#10B981', label: 'Completed' },
  FAILED: { color: '#EF4444', label: 'Failed' },
  BRIDGING: { color: '#8B5CF6', label: 'Bridging' },
};

export default function TransactionItem({
  type,
  amount,
  symbol = 'USDC',
  destination,
  status,
  timestamp,
  onPress,
}: TransactionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[type];
  const statusConfig = STATUS_CONFIG[status];

  const isIncoming = type === 'DEPOSIT' || type === 'RECEIVE';
  const formattedAmount = `${isIncoming ? '+' : '-'}${amount} ${symbol}`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      onPress={() => {
        setExpanded(!expanded);
        onPress?.();
      }}
      android_ripple={{ color: 'rgba(0, 0, 0, 0.05)' }}
    >
      <View style={styles.row}>
        <View style={[styles.iconContainer, { backgroundColor: `${config.color}15` }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>
        
        <View style={styles.info}>
          <Text style={styles.type}>{config.label}</Text>
          <Text style={styles.destination}>
            {destination || `${isIncoming ? 'From' : 'To'} ${symbol}`}
          </Text>
        </View>

        <View style={styles.right}>
          <Text style={[styles.amount, { color: isIncoming ? config.color : '#0F172A' }]}>
            {formattedAmount}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={styles.timestamp}>{timestamp}</Text>
          </View>
        </View>
      </View>

      {expanded && (
        <View style={styles.expanded}>
          <View style={styles.divider} />
          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}15` }]}>
                <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Transaction ID</Text>
              <Text style={styles.detailValue} numberOfLines={1}>0x7a8b...f8d2</Text>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  info: {
    flex: 1,
  },
  type: {
    fontSize: 15,
    fontFamily: 'Inter_600Semibold',
    color: '#0F172A',
    marginBottom: 2,
  },
  destination: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 15,
    fontFamily: 'Inter_600Semibold',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#94A3B8',
  },
  expanded: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  details: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#0F172A',
    maxWidth: 180,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
