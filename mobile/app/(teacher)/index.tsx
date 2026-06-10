import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesService } from '../../services/classesService';
import { topicsService } from '../../services/topicsService';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { DifficultyBadge } from '../../components/ui/DifficultyBadge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type { ClassDto, ClassDetailDto, TopicSummary } from '../../types';

// ─── Topic Card ───────────────────────────────────────────
function TopicCard({ topic, classId }: { topic: TopicSummary; classId: string }) {
  const qc = useQueryClient();

  const visibilityMut = useMutation({
    mutationFn: () => topicsService.updateVisibility(classId, topic.id, !topic.isDocumentVisible),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['class', classId] }),
  });

  const difficultyMut = useMutation({
    mutationFn: (d: string) => topicsService.updateDifficulty(classId, topic.id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['class', classId] }),
  });

  return (
    <View style={styles.topicCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.topicName}>{topic.name}</Text>
        <Text style={styles.topicMeta}>{topic.questionCount} câu hỏi</Text>
      </View>
      <DifficultyBadge difficulty={topic.difficulty} />
    </View>
  );
}

// ─── Class Detail View ────────────────────────────────────
function ClassDetail({ classId, onBack }: { classId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [classCode, setClassCode] = useState('');

  const { data: cls, isLoading } = useQuery({
    queryKey: ['class', classId],
    queryFn: () => classesService.getClass(classId),
  });

  if (isLoading || !cls) return (
    <View style={styles.center}>
      <Text style={styles.muted}>Đang tải...</Text>
    </View>
  );

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md }}>
      {/* Header */}
      <View style={styles.row}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.classTitle}>{cls.name}</Text>
          <Text style={styles.muted}>{cls.description}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.muted}>Học sinh</Text>
          <Text style={styles.statValue}>{cls.studentCount}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.muted}>Avg. Progress</Text>
          <Text style={styles.statValue}>{cls.averageProgress}%</Text>
          <ProgressBar value={cls.averageProgress} size="sm" />
        </Card>
        <Card style={[styles.statCard, { flex: 1.2 }]}>
          <Text style={styles.muted}>Mã lớp</Text>
          <Text style={[styles.statValue, { color: Colors.primary, fontSize: 15 }]}>{cls.classCode}</Text>
        </Card>
      </View>

      {/* Knowledge Base */}
      <Card padded={false}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Knowledge Base</Text>
          <Text style={styles.muted}>{cls.topics.length} topics</Text>
        </View>
        <View style={{ padding: Spacing.sm, gap: 8 }}>
          {cls.topics.map((t) => <TopicCard key={t.id} topic={t} classId={classId} />)}
        </View>
      </Card>

      <Button
        title="+ Thêm Topic"
        variant="outline"
        onPress={() => Alert.alert('Coming soon', 'Chức năng thêm topic sẽ có ở phiên bản tiếp theo')}
      />
    </ScrollView>
  );
}

// ─── Class Card ───────────────────────────────────────────
function ClassCard({ cls, onPress }: { cls: ClassDto; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.classCard} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.colorBar, { backgroundColor: cls.coverColor }]} />
      <View style={{ padding: Spacing.base }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.className} numberOfLines={1}>{cls.name}</Text>
            <Text style={styles.muted} numberOfLines={1}>{cls.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </View>
        <View style={[styles.row, { marginTop: 12, gap: 16 }]}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{cls.studentCount} HS</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="book-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{cls.topicCount} topics</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="bar-chart-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{cls.averageProgress}% avg</Text>
          </View>
        </View>
        <View style={{ marginTop: 10 }}>
          <ProgressBar value={cls.averageProgress} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function TeacherClassesScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: classes = [], isLoading, refetch } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: classesService.getTeacherClasses,
  });

  if (selectedId) return (
    <SafeAreaView style={styles.safeArea}>
      <ClassDetail classId={selectedId} onBack={() => setSelectedId(null)} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* App Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>EduBoost</Text>
          <Text style={styles.muted}>Teacher Dashboard</Text>
        </View>
        <View style={styles.headerAvatar}>
          <Text style={{ color: Colors.white, fontWeight: '700' }}>TA</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.muted}>{classes.length} lớp đang hoạt động</Text>
          <Button title="+ Tạo lớp" size="sm" onPress={() => Alert.alert('Tạo lớp', 'Chức năng đang phát triển')} />
        </View>

        {isLoading ? (
          <Text style={[styles.muted, { textAlign: 'center' }]}>Đang tải...</Text>
        ) : (
          classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} onPress={() => setSelectedId(cls.id)} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  appTitle: { ...Typography.h3, color: Colors.text },
  headerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  classCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  colorBar: { height: 5, width: '100%' },
  className: { ...Typography.h4, color: Colors.text },
  classTitle: { ...Typography.h3, color: Colors.text },
  muted: { ...Typography.caption, color: Colors.textMuted, marginTop: 1 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...Typography.captionSm, color: Colors.textMuted },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, gap: 4 },
  statValue: { ...Typography.h2, color: Colors.text },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sectionTitle: { ...Typography.h4, color: Colors.text },
  topicCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.surface, gap: 8,
  },
  topicName: { ...Typography.body, color: Colors.text, fontWeight: '500' },
  topicMeta: { ...Typography.captionSm, color: Colors.textMuted, marginTop: 2 },
});
