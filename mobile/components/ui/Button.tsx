import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Radius, Typography } from '../../theme';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle = {
    ...styles.base,
    ...sizeStyles[size],
    ...variantStyles[variant].container,
    ...(isDisabled && styles.disabled),
    ...style,
  };

  const labelStyle: TextStyle = {
    ...styles.label,
    ...sizeLabelStyles[size],
    ...variantStyles[variant].text,
    ...textStyle,
  };

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? Colors.white : Colors.primary}
        />
      ) : (
        <>
          {leftIcon}
          <Text style={labelStyle}>{title}</Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.lg,
  },
  label: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
});

const sizeStyles: Record<string, ViewStyle> = {
  sm: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.md },
  md: { paddingHorizontal: 18, paddingVertical: 11 },
  lg: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: Radius.xl },
};

const sizeLabelStyles: Record<string, TextStyle> = {
  sm: { fontSize: 13 },
  md: { fontSize: 14 },
  lg: { fontSize: 16 },
};

const variantStyles: Record<string, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: Colors.primary },
    text: { color: Colors.white },
  },
  outline: {
    container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.border },
    text: { color: Colors.text },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: Colors.text },
  },
  danger: {
    container: { backgroundColor: Colors.error },
    text: { color: Colors.white },
  },
};
