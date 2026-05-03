import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Typography } from '../../theme';

interface AvatarProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const sizeMap = { sm: 32, md: 40, lg: 52 };

export function Avatar({ initials, size = 'md', color = Colors.primary }: AvatarProps) {
  const dim = sizeMap[size];
  return (
    <View
      style={[
        styles.container,
        { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: color },
      ]}
    >
      <Text style={[styles.text, { fontSize: dim * 0.36 }]}>{initials.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.white,
    fontWeight: '700',
  },
});
