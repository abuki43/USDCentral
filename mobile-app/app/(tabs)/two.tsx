import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Pressable, Text, View, StyleSheet, ScrollView, SafeAreaView, Image, ImageSourcePropType } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';


import { firestore } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { AddressCardProps } from '@/components/ui/types';

type UserDoc = {
  circle?: {
    evmAddress?: string | null;
    solAddress?: string | null;
  };
};

function AddressCard({ title, address, networks, icon, iconColor, isSvgIcon, imageSource }: AddressCardProps & { imageSource?: ImageSourcePropType }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.cardIcon, { backgroundColor: `${iconColor}15` }]}>
            {imageSource ? (
              <Image source={imageSource} style={styles.svgIcon} />
            ) : (
              <Ionicons name={icon as any} size={22} color={iconColor} />
            )}
          </View>
          <View>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSubtitle}>{networks.join(' • ')}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.addressContainer}>
        <Text style={styles.address} numberOfLines={2}>
          {address ?? 'Setting up…'}
        </Text>
        {address && (
          <Pressable 
            style={styles.copyButtonInside}
            onPress={copyAddress}
            android_ripple={{ color: 'rgba(99, 102, 241, 0.1)' }}
          >
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#6366F1" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function DepositScreen() {
  const { user } = useAuthStore();
  const [evm, setEvm] = useState<string | null>(null);
  const [sol, setSol] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const ref = doc(firestore, 'users', user.uid);
    return onSnapshot(ref, (snap) => {
      const data = snap.data() as UserDoc | undefined;
      setEvm(data?.circle?.evmAddress ?? null);
      setSol(data?.circle?.solAddress ?? null);
    });
  }, [user]);

  const evmNetworks = ['Ethereum', 'Polygon', 'Arbitrum', 'Base', 'Optimism'];
  const solNetworks = ['Solana'];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Deposit</Text>
          <Text style={styles.subtitle}>Add USDC to your wallet from external sources</Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons name="wallet-outline" size={24} color="#6366F1" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Your Deposit Addresses</Text>
            <Text style={styles.infoText}>
              Each chain has its own deposit address. USDC sent from the wrong chain will be lost.
            </Text>
          </View>
        </View>

        {/* EVM Address Card */}
        <AddressCard
          title="EVM Chains"
          address={evm}
          networks={evmNetworks}
          icon="link"
          iconColor="#6366F1"
          imageSource={require('@/assets/images/eth.png')}
        />

        {/* Solana Address Card */}
        <AddressCard
          title="Solana"
          address={sol}
          networks={solNetworks}
          icon="solana"
          iconColor="#10B981"
          imageSource={require('@/assets/images/sol.png')}
        />

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
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    lineHeight: 18,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgIcon: {
    width: 28,
    height: 28,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    marginTop: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
  },
  copyText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#6366F1',
  },
  addressContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  address: {
    fontSize: 14,
    fontFamily: 'SpaceMono',
    color: '#0F172A',
    lineHeight: 20,
  },
  copyButtonInside: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -14 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipsText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
  },
  bottomPadding: {
    height: 100,
  },
});
