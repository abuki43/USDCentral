import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import AuthTextInput from '@/components/AuthTextInput';
import PrimaryButton from '@/components/PrimaryButton';
import { backendFetch } from '@/lib/backend';

type ResolvedRecipient = {
  uid: string;
  displayName: string | null;
  email: string | null;
};

export default function SendScreen() {
  const router = useRouter();
  const [recipientUid, setRecipientUid] = useState('');
  const [amount, setAmount] = useState('');
  const [resolved, setResolved] = useState<ResolvedRecipient | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canSend = useMemo(() => {
    return recipientUid.trim().length > 0 && Number(amount) > 0;
  }, [recipientUid, amount]);

  const resolveRecipient = async () => {
    const uid = recipientUid.trim();
    if (!uid) return;
    setIsResolving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const data = await backendFetch(`/transfer/resolve?uid=${encodeURIComponent(uid)}`);
      setResolved(data as ResolvedRecipient);
    } catch (error) {
      setResolved(null);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to resolve user');
    } finally {
      setIsResolving(false);
    }
  };

  const submitSend = async () => {
    const uid = recipientUid.trim();
    if (!uid) return;
    setIsSending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await backendFetch('/transfer/send', {
        method: 'POST',
        body: JSON.stringify({ recipientUid: uid, amount }),
      });
      setSuccessMessage('Transfer submitted. It may take a minute to confirm.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Transfer failed');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-surface-0">
      <View className="px-6 pt-6 pb-10">
        <Pressable onPress={() => router.back()} className="mb-6">
          <Text className="text-sm text-ink-600 font-sans-medium">Back</Text>
        </Pressable>

        <Text className="text-2xl text-ink-900 font-sans-semibold">Send USDC</Text>
        <Text className="text-ink-600 font-sans mt-2">
          Send USDC on Base Sepolia using a recipient UID.
        </Text>

        <View className="mt-6">
          <AuthTextInput
            label="Recipient UID"
            value={recipientUid}
            onChangeText={setRecipientUid}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable
            className="mb-6 items-center justify-center rounded-2xl border border-stroke-100 bg-surface-1 py-3"
            onPress={resolveRecipient}
            disabled={isResolving || recipientUid.trim().length === 0}
          >
            {isResolving ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-sm font-sans-semibold text-ink-700">Check recipient</Text>
            )}
          </Pressable>

          {resolved ? (
            <View className="mb-6 rounded-2xl border border-stroke-100 bg-surface-1 p-4">
              <Text className="text-sm text-ink-900 font-sans-semibold">Recipient found</Text>
              <Text className="text-xs text-ink-600 font-sans mt-1">
                {resolved.displayName ?? 'No name'} • {resolved.email ?? 'No email'}
              </Text>
            </View>
          ) : null}

          <AuthTextInput
            label="Amount (USDC)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />

          {errorMessage ? (
            <Text className="mb-4 text-sm text-danger-500 font-sans">{errorMessage}</Text>
          ) : null}
          {successMessage ? (
            <Text className="mb-4 text-sm text-success-600 font-sans">{successMessage}</Text>
          ) : null}

          <PrimaryButton
            label={isSending ? 'Sending…' : 'Send USDC'}
            onPress={submitSend}
            disabled={!canSend || isSending}
          />
        </View>
      </View>
    </ScrollView>
  );
}
