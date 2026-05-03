import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';

const MENU_ITEMS = [
  { icon: 'person-outline', label: 'Thông tin cá nhân' },
  { icon: 'notifications-outline', label: 'Thông báo' },
  { icon: 'shield-checkmark-outline', label: 'Quyền riêng tư' },
  { icon: 'help-circle-outline', label: 'Trợ giúp & hỗ trợ' },
  { icon: 'information-circle-outline', label: 'Về ứng dụng' },
];

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md }}>
        {/* Profile card */}
        <Card style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
          <Avatar initials={user?.avatar ?? user?.name?.slice(0, 2) ?? 'U'} size="lg" color={Colors.primary} />
          <Text style={[styles.name, { marginTop: 12 }]}>{user?.name ?? 'User'}</Text>
          <Text style={styles.muted}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name={user?.role === 'teacher' ? 'school-outline' : 'person-outline'} size={13} color={Colors.primary} />
            <Text style={styles.roleLabel}>{user?.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}</Text>
          </View>
        </Card>

        {/* Menu */}
        <Card padded={false}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, i < MENU_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}
              onPress={() => Alert.alert(item.label, 'Chức năng đang phát triển')}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon as any} size={18} color={Colors.textMuted} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </Card>

        <Button
          title="Đăng xuất"
          variant="danger"
          onPress={() => {
            Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
              { text: 'Huỷ', style: 'cancel' },
              { text: 'Đăng xuất', style: 'destructive', onPress: () => { logout(); } },
            ]);
          }}
        />

        <Text style={[styles.muted, { textAlign: 'center' }]}>EduBoost v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  name: { ...Typography.h3, color: Colors.text },
  muted: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${Colors.primary}15`, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: Radius.full, marginTop: 10,
  },
  roleLabel: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  menuIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { ...Typography.body, color: Colors.text, flex: 1 },
});
