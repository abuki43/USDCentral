import { Pressable, Text, ViewStyle, StyleProp, ActivityIndicator } from 'react-native';
import { ReactNode } from 'react';
import { ButtonProps } from './types';

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  style,
  fullWidth = true,
}: ButtonProps) {
  const sizeStyles = {
    sm: 'py-2 px-4',
    md: 'py-3.5 px-5',
    lg: 'py-4 px-6',
  };

  const textSizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const variantStyles = {
    primary: 'bg-primary-600 shadow-glow active:opacity-90',
    secondary: 'bg-surface-100 border border-stroke-200 active:bg-surface-200',
    ghost: 'bg-transparent active:bg-surface-100',
    danger: 'bg-danger-500 shadow-md active:opacity-90',
    success: 'bg-success-500 shadow-md active:opacity-90',
  };

  const textVariantStyles = {
    primary: 'text-white',
    secondary: 'text-ink-700',
    ghost: 'text-primary-600',
    danger: 'text-white',
    success: 'text-white',
  };

  const disabledStyles = disabled || loading ? 'opacity-50' : '';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`
        flex-row items-center justify-center gap-2 rounded-2xl
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${disabledStyles}
        ${fullWidth ? 'w-full' : ''}
      `}
      style={style}
      android_ripple={{ color: variant === 'primary' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' || variant === 'success' ? '#FFFFFF' : '#6366F1'} />
      ) : (
        <>
          {icon}
          <Text className={`font-sans-semibold ${textSizeStyles[size]} ${textVariantStyles[variant]}`}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
