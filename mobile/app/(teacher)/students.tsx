import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { studentsService } from '../../services/studentsService';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { Avatar } from '../../components/ui/Avatar';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Card } from '../../components/ui/Card';
import type { StudentAnalyticsDto } from '../../types';

const AVATAR_COLORS = ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

function StudentDetail({ student, onBack }: { student: StudentAnalyticsDto; onBack: () => void }) {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md }}>
      <View style={styles.row}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.sectionTitle}>Chi tiết học sinh</Text>
      </View>

      <Card>
        <View style={styles.row}>
          <Avatar initials={student.avatar ?? student.studentName.slice(0, 2)} size="lg" color={AVATAR_COLORS[0]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>{student.studentName}</Text>
            <Text style={styles.muted}>Hoạt động: {student.lastActive}</Text>
          </View>
        </View>
      </Card>

      <View style={styles.statsRow}>
        {[
          { label: 'Hoàn thành', value: `${student.completionPercent}%`, icon: 'trending-up-outline' },
          { label: 'Đã làm', value: String(student.quizzesTaken), icon: 'book-outline' },
          { label: 'Avg Score', value: `${student.averageScore}%`, icon: 'ribbon-outline' },
        ].map((s) => (
          <Card key={s.label} style={styles.statItem}>
            <Ionicons name={s.icon as any} size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.muted}>{s.label}</Text>
          </Card>
        ))}
      </View>

      <Card>
        <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
          <Text style={styles.sectionTitle}>Tiến độ tổng</Text>
          <Text style={{ color: Colors.primary, fontWeight: '700' }}>{student.completionPercent}%</Text>
        </View>
        <ProgressBar value={student.completionPercent} size="md" />
      </Card>

      {student.weakSkills.length > 0 && (
        <Card padded={false}>
          <View style={[styles.row, { padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
            <Ionicons name="warning-outline" size={16} color={Colors.warning} />
            <Text style={styles.sectionTitle}>Điểm yếu</Text>
          </View>
          <View style={{ padding: Spacing.base, gap: 14 }}>
            {student.weakSkills.map((s) => (
              <View key={s.topicId}>
                <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
                  <Text style={styles.bodyText}>{s.topicName}</Text>
                  <Text style={{ color: s.score < 50 ? Colors.error : Colors.warning, fontWeight: '700', fontSize: 13 }}>{s.score}%</Text>
                </View>
                <ProgressBar value={s.score} color={s.score < 50 ? 'error' : 'warning'} size="md" />
              </View>
            ))}
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

export default function StudentsScreen() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StudentAnalyticsDto | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['class-analytics', 'cls-1'],
    queryFn: () => studentsService.getClassAnalytics('cls-1'),
  });

  const students = (data?.students ?? []).filter((s) =>
    s.studentName.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) return (
    <SafeAreaView style={styles.safeArea}>
      <StudentDetail student={selected} onBack={() => setSelected(null)} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>Học sinh</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        {/* Summary */}
        <View style={styles.statsRow}>
          {[
            { label: 'Tổng', value: String(data?.totalStudents ?? 0) },
            { label: 'Avg %', value: `${data?.avgCompletion ?? 0}%` },
            { label: 'Cần chú ý', value: String(data?.needAttentionCount ?? 0) },
          ].map((s) => (
            <Card key={s.label} style={[styles.statItem, { alignItems: 'center' }]}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={[styles.muted, { textAlign: 'center' }]}>{s.label}</Text>
            </Card>
          ))}
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm học sinh..."
            placeholderTextColor={Colors.textDisabled}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* List */}
        <Card padded={false}>
          <View style={[styles.row, { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
            <Text style={[styles.muted, { textTransform: 'uppercase', letterSpacing: 0.5 }]}>{students.length} học sinh</Text>
          </View>
          {students.map((s, i) => (
            <TouchableOpacity
              key={s.studentId}
              style={styles.studentRow}
              onPress={() => setSelected(s)}
              activeOpacity={0.7}
            >
              <Avatar initials={s.avatar ?? s.studentName.slice(0, 2)} size="md" color={AVATAR_COLORS[i % AVATAR_COLORS.length]} />
              <View style={{ flex: 1 }}>
                <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
                  <Text style={styles.bodyText}>{s.studentName}</Text>
                  <Text style={[styles.muted, { fontWeight: '700' }]}>{s.completionPercent}%</Text>
                </View>
                <ProgressBar value={s.completionPercent} />
                <Text style={[styles.muted, { marginTop: 3 }]}>{s.lastActive}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  appTitle: { ...Typography.h3, color: Colors.text },
  muted: { ...Typography.caption, color: Colors.textMuted },
  bodyText: { ...Typography.body, color: Colors.text, fontWeight: '500' },
  sectionTitle: { ...Typography.h4, color: Colors.text },
  studentName: { ...Typography.h4, color: Colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statItem: { flex: 1, gap: 4 },
  statValue: { ...Typography.h2, color: Colors.text },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },
  studentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: `${Colors.border}60`,
  },
});
