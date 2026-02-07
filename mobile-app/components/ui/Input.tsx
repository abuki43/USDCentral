import { TextInput, Text, View, StyleSheet, TextInputProps } from 'react-native';
import { useState, forwardRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

type InputProps = TextInputProps & {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export default forwardRef<TextInput, InputProps>(function Input({ label, error, icon, containerStyle, ...props }, ref) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[
        styles.inputWrapper,
        isFocused && styles.inputWrapperFocused,
        error && styles.inputWrapperError,
      ]}>
        <Text style={[
          styles.label,
          isFocused && styles.labelFocused,
          error && styles.labelError,
        ]}>
          {label}
        </Text>
        <View style={styles.row}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <TextInput
            ref={ref}
            {...props}
            style={styles.input}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  inputWrapperFocused: {
    borderColor: '#6366F1',
    backgroundColor: '#F8FAFC',
    // Removed elevation/shadow preventing layout thrashing on Android
  },
  inputWrapperError: {
    borderColor: '#EF4444',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  labelFocused: {
    color: '#6366F1',
  },
  labelError: {
    color: '#EF4444',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#0F172A',
    padding: 0,
    marginLeft: 0,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 4,
  },
});
