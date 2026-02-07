import { ReactNode } from 'react';
import { ViewStyle, StyleProp, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================
// BUTTON TYPES
// ============================================

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

// ============================================
// INPUT TYPES
// ============================================

export interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

// ============================================
// BALANCE CARD TYPES
// ============================================

export interface BalanceCardProps {
  balance: string;
  symbol?: string;
  onHideToggle?: () => void;
  hidden?: boolean;
}

// ============================================
// ACTION BUTTONS TYPES
// ============================================

export type ActionVariant = 'withdraw' | 'send' | 'deposit';

export interface ActionButton {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: ActionVariant;
  onPress?: () => void;
}

// ============================================
// ALERT CARD TYPES
// ============================================

export type AlertType = 'success' | 'warning' | 'info';

export interface AlertCardProps {
  type: AlertType;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onDismiss?: () => void;
  autoDismiss?: boolean;
  duration?: number;
}

export interface AlertConfig {
  icon: 'checkmark-circle' | 'alert-circle' | 'information-circle';
  bgColor: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
}

// ============================================
// TRANSACTION TYPES
// ============================================

export type TransactionType = 'DEPOSIT' | 'WITHDRAW' | 'SEND' | 'RECEIVE' | 'SWAP' | 'BRIDGE' | 'EARN';
export type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'FAILED' | 'BRIDGING';

export interface TransactionItemProps {
  id: string;
  type: TransactionType;
  amount: string;
  symbol?: string;
  destination?: string;
  status: TransactionStatus;
  timestamp: string;
  onPress?: () => void;
}

export interface TransactionConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
}

export interface StatusConfig {
  color: string;
  label: string;
}

// ============================================
// ADDRESS CARD TYPES (Deposit Screen)
// ============================================

export interface AddressCardProps {
  title: string;
  address: string | null;
  networks: string[];
  icon: string;
  iconColor: string;
  isSvgIcon?: boolean;
}
