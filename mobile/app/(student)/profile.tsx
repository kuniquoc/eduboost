import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { studentsService } from '../../services/studentsService';
import { useAuthStore } from '../../store/authStore';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';

const MENU_ITEMS = [
  { icon: 'person-outline', label: 'Thông tin cá nhân' },
  { icon: 'notifications-outline', label: 'Thông báo' },
  { icon: 'help-circle-outline', label: 'Trợ giúp & hỗ trợ' },
  { icon: 'information-circle-outline', label: 'Về ứng dụng' },
];

export default function StudentProfileScreen() {
  const { user, logout } = useAuthStore();
  const { data: stats } = useQuery({
    queryKey: ['my-stats'],
    queryFn: studentsService.getMyStats,
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md }}>
        <Card style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
          <Avatar initials={user?.avatar ?? user?.name?.slice(0, 2) ?? 'U'} size="lg" color={Colors.primary} />
          <Text style={[styles.name, { marginTop: 12 }]}>{user?.name ?? 'Student'}</Text>
          <Text style={styles.muted}>{user?.email}</Text>
        </Card>

        {stats && (
          <View style={styles.statsRow}>
            {[
              { icon: '🔥', value: `${stats.dayStreak} ngày`, label: 'Streak' },
              { icon: '🎯', value: `${stats.avgQuizScore}%`, label: 'Avg Score' },
              { icon: '📝', value: String(stats.totalQuizzesTaken), label: 'Bài làm' },
            ].map((s) => (
              <Card key={s.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 20 }}>{s.icon}</Text>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.muted}>{s.label}</Text>
              </Card>
            ))}
          </View>
        )}

        <Card padded={false}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, i < MENU_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}
              onPress={() => Alert.alert(item.label, 'Đang phát triển')}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon as any} size={18} color={Colors.textMuted} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </Card>

        <Button title="Đăng xuất" variant="danger" onPress={() => Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [{ text: 'Huỷ' }, { text: 'Đăng xuất', style: 'destructive', onPress: logout }])} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  name: { ...Typography.h3, color: Colors.text },
  muted: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statValue: { ...Typography.h3, color: Colors.text },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  menuIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { ...Typography.body, color: Colors.text, flex: 1 },
});
