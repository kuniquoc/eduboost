import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { studentsService } from '../../services/studentsService';
import { roadmapService } from '../../services/roadmapService';
import { useAuthStore } from '../../store/authStore';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { RoadmapStepDto } from '../../types';

// ─── Roadmap Step ─────────────────────────────────────────
function RoadmapStep({ step, index, isLast }: { step: RoadmapStepDto; index: number; isLast: boolean }) {
  const isCompleted = step.status === 'completed';
  const isRecommended = step.status === 'recommended';
  const isLocked = step.status === 'locked';

  return (
    <View style={styles.stepRow}>
      <View style={styles.stepLeft}>
        <View style={[
          styles.stepCircle,
          isCompleted && { backgroundColor: Colors.success },
          isRecommended && { backgroundColor: Colors.primary },
          (!isCompleted && !isRecommended) && { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
        ]}>
          {isCompleted ? <Ionicons name="checkmark" size={14} color={Colors.white} /> :
            isLocked ? <Ionicons name="lock-closed" size={12} color={Colors.textMuted} /> :
              <Text style={[styles.stepNum, isRecommended && { color: Colors.white }]}>{index + 1}</Text>}
        </View>
        {!isLast && <View style={[styles.stepLine, isCompleted && { backgroundColor: `${Colors.success}50` }]} />}
      </View>

      <View style={[
        styles.stepContent,
        isRecommended && { backgroundColor: `${Colors.primary}12`, borderColor: `${Colors.primary}30`, borderWidth: 1 },
        isCompleted && { backgroundColor: `${Colors.success}08` },
        (!isCompleted && !isRecommended) && { backgroundColor: Colors.surface },
      ]}>
        <View style={styles.stepHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stepTitle, isLocked && { color: Colors.textMuted }]}>{step.topicName}</Text>
            {step.reason && (
              <View style={styles.row}>
                <Ionicons name="sparkles" size={11} color={Colors.primary} />
                <Text style={styles.stepReason}>{step.reason}</Text>
              </View>
            )}
            {isCompleted && <Text style={{ ...Typography.captionSm, color: Colors.success, marginTop: 2 }}>✓ Hoàn thành</Text>}
          </View>
          {isRecommended && (
            <View style={styles.studyBtn}>
              <Text style={styles.studyBtnText}>Học ngay</Text>
            </View>
          )}
        </View>
        {!isLocked && step.progress > 0 && (
          <View style={{ marginTop: 8 }}>
            <ProgressBar value={step.progress} color={isCompleted ? 'success' : 'primary'} size="sm" />
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Home Screen ─────────────────────────────────────
export default function StudentHomeScreen() {
  const { user } = useAuthStore();

  const { data: progress, isLoading: loadingProgress, refetch } = useQuery({
    queryKey: ['my-progress'],
    queryFn: studentsService.getMyProgress,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['my-stats'],
    queryFn: studentsService.getMyStats,
  });

  // Lấy lớp đầu tiên đã đăng ký để hiển thị roadmap preview
  const firstClassId = progress?.enrolledClasses?.[0]?.classId;

  const { data: roadmap } = useQuery({
    queryKey: ['roadmap', firstClassId],
    queryFn: () => roadmapService.getRoadmap(firstClassId!),
    enabled: !!firstClassId,
  });

  const avgProg = progress?.overallProgress ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>EduBoost</Text>
          <Text style={styles.muted}>Xin chào, {user?.name?.split(' ').pop()} 👋</Text>
        </View>
        <View style={styles.headerAvatar}>
          <Text style={{ color: Colors.white, fontWeight: '700' }}>{user?.avatar ?? 'U'}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md }}
        refreshControl={<RefreshControl refreshing={loadingProgress} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        {/* Overall progress card */}
        <View style={styles.heroBanner}>
          <View>
            <Text style={styles.heroLabel}>Tổng tiến độ</Text>
            <Text style={styles.heroValue}>{avgProg}%</Text>
            <Text style={styles.heroSub}>{progress?.enrolledClasses.length ?? 0} lớp học</Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="trending-up" size={32} color={Colors.white} />
          </View>
        </View>

        {/* Quick stats */}
        {stats && (
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <View style={styles.row}>
                <Ionicons name="flame" size={16} color={Colors.warning} />
                <Text style={styles.statLabel}>Streak</Text>
              </View>
              <Text style={styles.statValue}>{stats.dayStreak} ngày</Text>
              <Text style={styles.muted}>Tiếp tục!</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={styles.row}>
                <Ionicons name="ribbon" size={16} color={Colors.success} />
                <Text style={styles.statLabel}>Điểm TB</Text>
              </View>
              <Text style={styles.statValue}>{stats.avgQuizScore}%</Text>
              <Text style={styles.muted}>Tuần này</Text>
            </Card>
          </View>
        )}

        {/* Recent classes */}
        {progress?.enrolledClasses && progress.enrolledClasses.length > 0 && (
          <Card padded={false}>
            <View style={[styles.cardHeader]}>
              <Text style={styles.sectionTitle}>Lớp học gần đây</Text>
              <Text style={styles.seeAll}>Xem tất cả</Text>
            </View>
            <View style={{ padding: Spacing.sm, gap: 4 }}>
              {progress.enrolledClasses.map((cls) => (
                <View key={cls.classId} style={styles.classRow}>
                  <View style={[styles.colorDot, { backgroundColor: cls.coverColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bodyText} numberOfLines={1}>{cls.className}</Text>
                    <ProgressBar value={cls.progress} />
                  </View>
                  <Text style={[styles.muted, { fontWeight: '700' }]}>{cls.progress}%</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Roadmap preview */}
        {roadmap && (
          <Card padded={false}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>Lộ trình học tập</Text>
              <Text style={styles.muted}>Advanced Math</Text>
            </View>
            <View style={{ padding: Spacing.base }}>
              {roadmap.steps.slice(0, 4).map((step, i) => (
                <RoadmapStep key={step.id} step={step} index={i} isLast={i === Math.min(3, roadmap.steps.length - 1)} />
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  appTitle: { ...Typography.h3, color: Colors.text },
  muted: { ...Typography.caption, color: Colors.textMuted },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  heroBanner: {
    backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.lg,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  heroLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.8)' },
  heroValue: { ...Typography.h1, color: Colors.white, marginTop: 2 },
  heroSub: { ...Typography.captionSm, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  heroIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, gap: 4 },
  statLabel: { ...Typography.captionSm, color: Colors.textMuted },
  statValue: { ...Typography.h2, color: Colors.text },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sectionTitle: { ...Typography.h4, color: Colors.text },
  seeAll: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.sm, borderRadius: Radius.lg },
  colorDot: { width: 4, height: 42, borderRadius: 2 },
  bodyText: { ...Typography.body, color: Colors.text, fontWeight: '500', marginBottom: 6 },
  // Roadmap
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  stepLeft: { alignItems: 'center' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  stepLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginTop: 4 },
  stepNum: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  stepContent: { flex: 1, padding: 12, borderRadius: Radius.lg, marginBottom: 4 },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  stepTitle: { ...Typography.body, color: Colors.text, fontWeight: '500' },
  stepReason: { ...Typography.captionSm, color: Colors.primary, marginLeft: 4, flex: 1 },
  studyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  studyBtnText: { fontSize: 12, color: Colors.white, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
