import { useState, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View, StyleSheet, ScrollView, Image } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function RegisterScreen() {
  const { register, isSubmitting, errorMessage, clearError, user, initializing } =
    useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (initializing) {
    return null;
  }

  if (user) {
    return null;
  }

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPasswordValid = password.length >= 8 && /[A-Z]/.test(password);
  const isDisplayNameValid = displayName.trim().length > 0;
  const isFormValid = isEmailValid && isPasswordValid && isDisplayNameValid;

  const disabled = isSubmitting || !isFormValid;

  const nameIcon = useMemo(() => (
    <Ionicons name="person-outline" size={20} color="#94A3B8" />
  ), []);

  const emailIcon = useMemo(() => (
    <Ionicons name="mail-outline" size={20} color="#94A3B8" />
  ), []);

  const passwordIcon = useMemo(() => (
    <Pressable onPress={() => setShowPassword(!showPassword)}>
      <Ionicons
        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
        size={20}
        color="#94A3B8"
      />
    </Pressable>
  ), [showPassword]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image 
            source={require('@/assets/images/logo.png')} 
            style={styles.logoImage} 
            resizeMode="contain"
          />
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Start building your unified USDC balance</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Full Name"
            value={displayName}
            onChangeText={(value) => {
              if (errorMessage) clearError();
              setDisplayName(value);
            }}
            placeholder="Enter your full name"
            autoCapitalize="words"
            icon={nameIcon}
          />

          <Input
            label="Email"
            value={email}
            onChangeText={(value) => {
              if (errorMessage) clearError();
              setEmail(value);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter your email"
            icon={emailIcon}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={(value) => {
              if (errorMessage) clearError();
              setPassword(value);
            }}
            secureTextEntry={!showPassword}
            placeholder="Create a password"
            icon={passwordIcon}
          />

          <View style={styles.passwordRequirements}>
            <View style={styles.requirement}>
              <Ionicons name={password.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={password.length >= 8 ? '#10B981' : '#94A3B8'} />
              <Text style={[styles.requirementText, password.length >= 8 && styles.requirementMet]}>At least 8 characters</Text>
            </View>
            <View style={styles.requirement}>
              <Ionicons name={/[A-Z]/.test(password) ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={/[A-Z]/.test(password) ? '#10B981' : '#94A3B8'} />
              <Text style={[styles.requirementText, /[A-Z]/.test(password) && styles.requirementMet]}>One uppercase letter</Text>
            </View>
          </View>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By creating an account, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>

          <Button
            label={isSubmitting ? 'Creating account...' : 'Create Account'}
            onPress={() => register(email, password, displayName)}
            disabled={disabled}
            loading={isSubmitting}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 120,
    height: 120,
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
  form: {
    gap: 20,
  },
  passwordRequirements: {
    gap: 8,
    marginTop: -8,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#94A3B8',
  },
  requirementMet: {
    color: '#10B981',
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
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#EF4444',
  },
  termsContainer: {
    marginVertical: 4,
  },
  termsText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
  },
  footerLink: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#6366F1',
    marginLeft: 4,
  },
});
