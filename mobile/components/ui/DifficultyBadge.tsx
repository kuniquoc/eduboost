import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Typography } from '../../theme';

type DifficultyLevel = 'easy' | 'medium' | 'hard';

const config: Record<DifficultyLevel, { label: string; bg: string; text: string }> = {
  easy: { label: 'Dễ', bg: `${Colors.success}20`, text: Colors.success },
  medium: { label: 'Trung bình', bg: `${Colors.warning}20`, text: Colors.warning },
  hard: { label: 'Khó', bg: `${Colors.error}20`, text: Colors.error },
};

export function DifficultyBadge({ difficulty }: { difficulty: DifficultyLevel }) {
  const { label, bg, text } = config[difficulty] ?? config.medium;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  label: {
    ...Typography.captionSm,
    fontWeight: '600',
  },
});
