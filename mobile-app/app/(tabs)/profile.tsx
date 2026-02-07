import { useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet, SafeAreaView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '@/store/authStore';
import { useLocalAuthStore } from '@/store/localAuthStore';
import LocalAuthSection from '@/components/LocalAuthSection';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, isSubmitting } = useAuthStore();
  const { clearError } = useLocalAuthStore();

  const [copied, setCopied] = useState(false);

  const handleCopyUid = async () => {
    if (!user?.uid) return;
    await Clipboard.setStringAsync(user.uid);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Pressable 
            style={styles.settingsButton}
            android_ripple={{ color: 'rgba(99, 102, 241, 0.1)' }}
          >
            <Ionicons name="settings-outline" size={22} color="#0F172A" />
          </Pressable>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.displayName?.charAt(0) || 'U').toUpperCase()}
              </Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            </View>
          </View>
          
          <Text style={styles.displayName}>{user?.displayName ?? 'User'}</Text>
          <Text style={styles.email}>{user?.email ?? '—'}</Text>

          <Pressable 
            style={styles.uidRow}
            onPress={handleCopyUid}
            android_ripple={{ color: 'rgba(0, 0, 0, 0.05)' }}
          >
            <Text style={styles.uidLabel}>App ID</Text>
            <View style={styles.uidContainer}>
              <Text style={styles.uid} numberOfLines={1}>
                {user?.uid ?? '—'}
              </Text>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#6366F1" />
            </View>
          </Pressable>
        </View>

        {/* Local Auth Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <LocalAuthSection />
        </View>

        {/* Quick Links */}
        <View style={styles.linksSection}>
          <Text style={styles.sectionTitle}>Information</Text>
          
          <Pressable 
            style={styles.linkRow}
            android_ripple={{ color: 'rgba(0, 0, 0, 0.05)' }}
          >
            <View style={styles.linkIcon}>
              <Ionicons name="information-circle-outline" size={20} color="#6366F1" />
            </View>
            <Text style={styles.linkText}>About</Text>
            <Text style={styles.linkVersion}>v1.0.0</Text>
          </Pressable>
        </View>

        {/* Sign Out */}
        <Pressable 
          style={styles.signOutButton}
          onPress={handleLogout}
          disabled={isSubmitting}
          android_ripple={{ color: 'rgba(239, 68, 68, 0.1)' }}
        >
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={styles.signOutText}>
            {isSubmitting ? 'Signing out...' : 'Sign Out'}
          </Text>
        </Pressable>

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
  },
  settingsButton: {
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
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  displayName: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    marginBottom: 20,
  },
  uidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  uidLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
  },
  uidContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uid: {
    fontSize: 13,
    fontFamily: 'SpaceMono',
    color: '#0F172A',
    maxWidth: 150,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  linksSection: {
    marginBottom: 20,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  linkText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#0F172A',
  },
  linkVersion: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#94A3B8',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  signOutText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#EF4444',
  },
  bottomPadding: {
    height: 100,
  },
});
