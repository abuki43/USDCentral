import { View, ViewStyle, StyleProp } from 'react-native';
import { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'glass' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
};

export default function Card({ 
  children, 
  style, 
  variant = 'default',
  padding = 'md'
}: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  };

  const variantStyles = {
    default: 'bg-white border border-stroke-100',
    elevated: 'bg-white shadow-strong',
    glass: 'bg-glass-light backdrop-blur-xl border border-white/20',
    outlined: 'bg-white border-2 border-stroke-200',
  };

  return (
    <View className={`${paddingStyles[padding]} rounded-3xl ${variantStyles[variant]} ${style as string}`}>
      {children}
    </View>
  );
}
