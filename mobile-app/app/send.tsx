import { useEffect, useMemo, useState } from 'react';
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
      const data = await backendFetch(
        recipientMode === 'email'
          ? `/transfer/resolve-email?email=${encodeURIComponent(email)}`
          : `/transfer/resolve?uid=${encodeURIComponent(uid)}`,
      );
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
    const email = recipientEmail.trim();
    if (recipientMode === 'appId' && !uid) return;
    if (recipientMode === 'email' && !email) return;
    if (!resolved?.uid) return;
    setIsSending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await backendFetch('/transfer/send', {
        method: 'POST',
        body: JSON.stringify({ recipientUid: resolved.uid, amount }),
      });
      setSuccessMessage('Transfer submitted. Returning to home…');
      setRecipientUid('');
      setRecipientEmail('');
      setAmount('');
      setResolved(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Transfer failed');
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
    <ScrollView className="flex-1 bg-surface-0">
      <View className="px-6 pt-6 pb-10">
        <Pressable onPress={() => router.back()} className="mb-6">
          <Text className="text-sm text-ink-600 font-sans-medium">Back</Text>
        </Pressable>

        <Text className="text-2xl text-ink-900 font-sans-semibold">Send USDC</Text>
        <Text className="text-ink-600 font-sans mt-2">
          Send USDC on Base Sepolia using an App ID or email.
        </Text>

        <View className="mt-6">
          <View className="mb-4 flex-row rounded-2xl border border-stroke-100 bg-surface-1 p-1">
            <Pressable
              className={
                recipientMode === 'appId'
                  ? 'flex-1 items-center justify-center rounded-2xl bg-surface-0 py-2'
                  : 'flex-1 items-center justify-center rounded-2xl py-2'
              }
              onPress={() => {
                setRecipientMode('appId');
                setResolved(null);
                setErrorMessage(null);
              }}
            >
              <Text className="text-xs font-sans-semibold text-ink-800">App ID</Text>
            </Pressable>
            <Pressable
              className={
                recipientMode === 'email'
                  ? 'flex-1 items-center justify-center rounded-2xl bg-surface-0 py-2'
                  : 'flex-1 items-center justify-center rounded-2xl py-2'
              }
              onPress={() => {
                setRecipientMode('email');
                setResolved(null);
                setErrorMessage(null);
              }}
            >
              <Text className="text-xs font-sans-semibold text-ink-800">Email</Text>
            </Pressable>
          </View>

          {recipientMode === 'appId' ? (
            <AuthTextInput
              label="Recipient App ID"
              value={recipientUid}
              onChangeText={setRecipientUid}
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : (
            <AuthTextInput
              label="Recipient Email"
              value={recipientEmail}
              onChangeText={setRecipientEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          )}

          <Pressable
            className="mb-6 items-center justify-center rounded-2xl border border-stroke-100 bg-surface-1 py-3"
            onPress={resolveRecipient}
            disabled={
              isResolving ||
              (recipientMode === 'appId'
                ? recipientUid.trim().length === 0
                : recipientEmail.trim().length === 0)
            }
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
              {recipientMode === 'email' ? (
                <Text className="text-xs text-ink-600 font-sans mt-1">
                  {resolved.displayName ?? 'No name'} • {resolved.email ?? 'No email'}
                </Text>
              ) : (
                <Text className="text-xs text-ink-600 font-sans mt-1">
                  App ID available for transfer.
                </Text>
              )}
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
