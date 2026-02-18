import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, StyleSheet, SafeAreaView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { api, type ResolvedRecipient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type RecipientMode = 'appId' | 'email';

export default function SendScreen() {
  const router = useRouter();
  const [recipientUid, setRecipientUid] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('appId');
  const [amount, setAmount] = useState('');
  const [resolved, setResolved] = useState<ResolvedRecipient | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canSend = useMemo(() => {
    const recipientValue =
      recipientMode === 'email' ? recipientEmail.trim() : recipientUid.trim();
    return recipientValue.length > 0 && Number(amount) > 0 && Boolean(resolved?.uid);
  }, [recipientEmail, recipientMode, recipientUid, amount, resolved?.uid]);

  const resolveRecipient = async () => {
    const uid = recipientUid.trim();
    const email = recipientEmail.trim();
    const lookupValue = recipientMode === 'email' ? email : uid;
    if (!lookupValue) return;
    setIsResolving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const data =
        recipientMode === 'email'
          ? await api.transfer.resolveEmail(email)
          : await api.transfer.resolve(uid);
      setResolved(data);
    } catch (error) {
      setResolved(null);
      setErrorMessage(getErrorMessage(error, 'Failed to resolve user'));
    } finally {
      setIsResolving(false);
    }
  };

  const submitSend = async () => {
    const uid = recipientUid.trim();
    const email = recipientEmail.trim();
    if (recipientMode === 'appId' && !uid) return;
    if (recipientMode === 'email' && !email) return;
    if (!resolved?.uid) return;
    setIsSending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.transfer.send({ recipientUid: resolved.uid, amount });
      setSuccessMessage('Transfer submitted. Returning to home…');
      setRecipientUid('');
      setRecipientEmail('');
      setAmount('');
      setResolved(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Transfer failed'));
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => {
      router.replace('/');
    }, 1500);
    return () => clearTimeout(timer);
  }, [successMessage, router]);

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
          <Text style={styles.title}>Send USDC</Text>
          <Text style={styles.subtitle}>
            Send USDC on Arbitrum using an App ID or email.
          </Text>
        </View>

        <View style={styles.tabContainer}>
          <Pressable
            style={[styles.tab, recipientMode === 'appId' && styles.tabActive]}
            onPress={() => {
              setRecipientMode('appId');
              setResolved(null);
              setErrorMessage(null);
            }}
          >
            <Text style={[styles.tabText, recipientMode === 'appId' && styles.tabTextActive]}>
              App ID
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, recipientMode === 'email' && styles.tabActive]}
            onPress={() => {
              setRecipientMode('email');
              setResolved(null);
              setErrorMessage(null);
            }}
          >
            <Text style={[styles.tabText, recipientMode === 'email' && styles.tabTextActive]}>
              Email
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          {recipientMode === 'appId' ? (
            <Input
              label="Recipient App ID"
              value={recipientUid}
              onChangeText={setRecipientUid}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter App ID"
            />
          ) : (
            <Input
              label="Recipient Email"
              value={recipientEmail}
              onChangeText={setRecipientEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Enter email"
            />
          )}

          <Pressable
            style={[styles.checkButton, (isResolving || (recipientMode === 'appId' ? recipientUid.trim().length === 0 : recipientEmail.trim().length === 0)) && styles.checkButtonDisabled]}
            onPress={resolveRecipient}
            disabled={isResolving || (recipientMode === 'appId' ? recipientUid.trim().length === 0 : recipientEmail.trim().length === 0)}
          >
            {isResolving ? (
              <ActivityIndicator color="#6366F1" />
            ) : (
              <Text style={styles.checkButtonText}>Check recipient</Text>
            )}
          </Pressable>

          {resolved ? (
            <View style={styles.resolvedCard}>
              <View style={styles.resolvedIcon}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              </View>
              <View style={styles.resolvedInfo}>
                <Text style={styles.resolvedTitle}>Recipient found</Text>
                <Text style={styles.resolvedSubtitle}>
                  {recipientMode === 'email' 
                    ? `${resolved.displayName ?? 'No name'} • ${resolved.email ?? 'No email'}`
                    : 'App ID available for transfer'}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.amountContainer}>
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

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}

          <Button
            label={isSending ? 'Sending…' : 'Send USDC'}
            onPress={submitSend}
            disabled={!canSend || isSending}
            loading={isSending}
          />
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 6,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
  },
  card: {
    gap: 16,
  },
  checkButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkButtonDisabled: {
    opacity: 0.5,
  },
  checkButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  resolvedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  resolvedIcon: {
    marginRight: 12,
  },
  resolvedInfo: {
    flex: 1,
  },
  resolvedTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#166534',
  },
  resolvedSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#15803D',
    marginTop: 2,
  },
  amountContainer: {
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  currencySymbol: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: '#6366F1',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
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
