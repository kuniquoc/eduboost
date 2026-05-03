import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function LoginScreen() {
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập email'); return; }
    if (!password) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập mật khẩu'); return; }
    setLoading(true);
    try {
      const result = await authService.login(email.trim(), password);
      setAuth(result.user);
      router.replace(result.user.role === 'teacher' ? '/(teacher)' : '/(student)');
    } catch (e: any) {
      const msg: string = e.message ?? '';
      // Phân loại lỗi để hiển thị thông báo phù hợp
      if (msg.includes('Network Error') || msg.includes('timeout')) {
        Alert.alert('Không thể kết nối', 'Kiểm tra kết nối mạng và thử lại.');
      } else if (msg) {
        // Hiển thị message cụ thể từ server (Vd: "Email chưa đăng ký", "Mật khẩu không chính xác")
        Alert.alert('Đăng nhập thất bại', msg);
      } else {
        Alert.alert('Đăng nhập thất bại', 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Quick login cho development — dùng tài khoản seed có sẵn
  const quickLogin = async (role: 'teacher' | 'student') => {
    setLoading(true);
    try {
      const email = role === 'teacher' ? 'teacher@eduboost.vn' : 'student@eduboost.vn';
      const result = await authService.login(email, 'password123');
      setAuth(result.user);
      router.replace(role === 'teacher' ? '/(teacher)' : '/(student)');
    } catch {
      // Fallback: nếu server chưa có seed data thì dùng mock local
      const user = {
        userId: role === 'teacher' ? 'teacher-dev' : 'student-dev',
        name: role === 'teacher' ? 'Nguyễn Thành An' : 'Lê Thị Bảo',
        email: role === 'teacher' ? 'teacher@eduboost.vn' : 'student@eduboost.vn',
        role,
        avatar: role === 'teacher' ? 'TA' : 'LB',
      };
      setAuth(user);
      router.replace(role === 'teacher' ? '/(teacher)' : '/(student)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoIcon}>
            <Ionicons name="school" size={36} color={Colors.white} />
          </View>
          <Text style={styles.logoTitle}>EduBoost</Text>
          <Text style={styles.logoSub}>Học thông minh, tiến xa hơn</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="email@example.com" leftIcon={<Ionicons name="mail-outline" size={16} color={Colors.textMuted} />} />
          <Input label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" leftIcon={<Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} />} />
          <Button title="Đăng nhập" onPress={handleLogin} loading={loading} size="lg" />
        </View>

        {/* Quick demo */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Demo nhanh</Text>
          <View style={styles.dividerLine} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button title="👨‍🏫 Giáo viên" variant="outline" onPress={() => quickLogin('teacher')} style={{ flex: 1 }} />
          <Button title="👨‍🎓 Học sinh" variant="outline" onPress={() => quickLogin('student')} style={{ flex: 1 }} />
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.registerLink}>Chưa có tài khoản? <Text style={{ color: Colors.primary, fontWeight: '700' }}>Đăng ký</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  logoSection: { alignItems: 'center', paddingVertical: Spacing['2xl'] },
  logoIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoTitle: { ...Typography.h1, color: Colors.text },
  logoSub: { ...Typography.body, color: Colors.textMuted, marginTop: 4 },
  form: { gap: Spacing.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { ...Typography.caption, color: Colors.textMuted },
  registerLink: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
});
