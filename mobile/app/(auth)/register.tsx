import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { Colors, Spacing, Typography } from '../../theme';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function RegisterScreen() {
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) { Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ'); return; }
    setLoading(true);
    try {
      const result = await authService.register(name, email, password, role);
      setAuth(result.user);
      router.replace(result.user.role === 'teacher' ? '/(teacher)' : '/(student)');
    } catch (e: any) {
      Alert.alert('Lỗi đăng ký', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
          <Text style={{ color: Colors.text }}>Quay lại</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Tạo tài khoản</Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(['student', 'teacher'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleBtn, role === r && styles.roleBtnActive]}
              onPress={() => setRole(r)}
            >
              <Ionicons name={r === 'teacher' ? 'school-outline' : 'person-outline'} size={16} color={role === r ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.roleLabel, role === r && { color: Colors.primary }]}>{r === 'teacher' ? 'Giáo viên' : 'Học sinh'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ gap: Spacing.md }}>
          <Input label="Họ và tên" value={name} onChangeText={setName} placeholder="Nguyễn Văn A" />
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="email@example.com" />
          <Input label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry placeholder="Ít nhất 6 ký tự" />
          <Button title="Đăng ký" onPress={handleRegister} loading={loading} size="lg" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  title: { ...Typography.h1, color: Colors.text },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border },
  roleBtnActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}12` },
  roleLabel: { ...Typography.body, color: Colors.textMuted, fontWeight: '500' },
});
