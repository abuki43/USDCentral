import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AlertCardProps, AlertType } from '@/components/ui/types';

type FAQItem = {
  id: string;
  question: string;
  answer: string;
  icon: keyof typeof Ionicons.glyphMap;
  alertType?: AlertType;
};

const FAQ_DATA: FAQItem[] = [
  {
    id: 'stablecoin',
    question: 'What is a Stablecoin?',
    answer: 'A stablecoin is a cryptocurrency designed to maintain a stable value, typically pegged to a fiat currency like the US Dollar. USDC is backed by fully reserved assets and redeemable 1:1 for US dollars.',
    icon: 'wallet-outline',
  },
  {
    id: 'usdc',
    question: 'What is USDC?',
    answer: 'USDC is a fully collateralized US dollar stablecoin. Each USDC is backed by one US dollar held in reserve, making it a trustworthy digital dollar for payments and DeFi.',
    icon: 'logo-usd',
  },
  {
    id: 'gas',
    question: 'What are Gas Fees?',
    answer: 'Gas fees are payments made to network validators for processing transactions on blockchain networks. Think of it as a processing fee that goes to the computers maintaining the network.',
    icon: 'flame-outline',
  },
  {
    id: 'liquidity',
    question: 'How Does Liquidity Work?',
    answer: 'Providing liquidity means depositing your crypto into a pool that others can trade against. In return, you earn a share of trading fees paid by users who swap through the pool.',
    icon: 'trending-up-outline',
  },
  {
    id: 'liquidity-risks',
    question: 'What Are the Risks of Providing Liquidity?',
    answer: 'Main risks include impermanent loss (temporary value drop when pool prices change) and smart contract vulnerabilities. Always research before depositing funds.',
    icon: 'shield-checkmark-outline',
  },
];

type FAQCardProps = {
  item: FAQItem;
  isExpanded: boolean;
  onToggle: () => void;
};

function FAQCard({ item, isExpanded, onToggle }: FAQCardProps) {
  return (
    <View style={styles.faqCard}>
      <Pressable
        style={styles.faqHeader}
        onPress={onToggle}
        android_ripple={{ color: 'rgba(99, 102, 241, 0.1)' }}
      >
        <View style={styles.faqIcon}>
          <Ionicons name={item.icon} size={20} color="#6366F1" />
        </View>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#64748B"
        />
      </Pressable>

      {isExpanded && (
        <View style={styles.faqAnswer}>
          <Text style={styles.answerText}>{item.answer}</Text>
        </View>
      )}
    </View>
  );
}

export default function LearnModal() {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Learn</Text>
            <Text style={styles.subtitle}>
              Understand the basics of DeFi and cryptocurrency
            </Text>
          </View>
          <Pressable 
            style={styles.closeButton}
            onPress={handleClose}
            android_ripple={{ color: 'rgba(99, 102, 241, 0.1)' }}
          >
            <Ionicons name="close" size={24} color="#0F172A" />
          </Pressable>
        </View>

        <View style={styles.faqList}>
          {FAQ_DATA.map((item) => (
            <FAQCard
              key={item.id}
              item={item}
              isExpanded={expandedId === item.id}
              onToggle={() => handleToggle(item.id)}
            />
          ))}
        </View>

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={18} color="#94A3B8" />
          <Text style={styles.disclaimerText}>
            This content is for educational purposes only and does not constitute financial advice.
          </Text>
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerContent: {
    flex: 1,
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
  closeButton: {
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
  faqList: {
    gap: 12,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  faqIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  faqAnswer: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 0,
  },
  answerText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    lineHeight: 22,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
    gap: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#94A3B8',
    lineHeight: 18,
  },
  bottomPadding: {
    height: 100,
  },
});
