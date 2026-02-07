import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { AlertCardProps, AlertConfig, AlertType } from './types';

const ALERT_CONFIG: Record<AlertType, AlertConfig> = {
  success: {
    icon: 'checkmark-circle',
    bgColor: '#ECFDF5',
    borderColor: '#10B981',
    iconColor: '#10B981',
    textColor: '#047857',
  },
  warning: {
    icon: 'alert-circle',
    bgColor: '#FFF7ED',
    borderColor: '#F59E0B',
    iconColor: '#F59E0B',
    textColor: '#B45309',
  },
  info: {
    icon: 'information-circle',
    bgColor: '#EEF2FF',
    borderColor: '#6366F1',
    iconColor: '#6366F1',
    textColor: '#4338CA',
  },
};

export default function AlertCard({
  type,
  title,
  message,
  icon,
  onDismiss,
  autoDismiss = false,
  duration = 6000,
}: AlertCardProps) {
  const config = ALERT_CONFIG[type];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    if (autoDismiss) {
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -20,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => onDismiss?.());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [autoDismiss, duration, fadeAnim, slideAnim, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.iconWrapper, { backgroundColor: `${config.iconColor}20` }]}>
        <Ionicons name={icon || config.icon} size={20} color={config.iconColor} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: config.textColor }]}>{title}</Text>
        <Text style={[styles.message, { color: config.textColor }]}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    opacity: 0.85,
  },
});
