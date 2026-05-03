import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors, Radius } from '../../theme';

interface ProgressBarProps {
  value: number; // 0-100
  color?: 'primary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

const colorMap = {
  primary: Colors.primary,
  success: Colors.success,
  warning: Colors.warning,
  error: Colors.error,
};

const sizeMap = {
  sm: 4,
  md: 6,
  lg: 8,
};

export function ProgressBar({ value, color = 'primary', size = 'sm' }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const height = sizeMap[size];

  return (
    <View style={[styles.track, { height }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clampedValue}%`,
            backgroundColor: colorMap[color],
            height,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: Radius.full,
  },
});
