import { useState, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View, StyleSheet, ScrollView, Image } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function LoginScreen() {
  const { login, isSubmitting, errorMessage, clearError, user, initializing } =
    useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (initializing) {
    return null;
  }

  if (user) {
    return null;
  }

  const disabled = isSubmitting || !email.trim() || !password;

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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue to USDCentral</Text>
        </View>

        <View style={styles.form}>
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
            placeholder="Enter your password"
            icon={passwordIcon}
          />

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <Pressable style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </Pressable>

          <Button
            label={isSubmitting ? 'Signing in...' : 'Sign In'}
            onPress={() => login(email, password)}
            disabled={disabled}
            loading={isSubmitting}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>New here?</Text>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Create an account</Text>
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#6366F1',
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
