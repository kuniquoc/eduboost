import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { classesService } from '../../services/classesService';
import { roadmapService } from '../../services/roadmapService';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Button } from '../../components/ui/Button';
import type { ClassDto, RoadmapStepDto, RoadmapDto } from '../../types';

// ─── Roadmap View ──────────────────────────────────────────
function RoadmapView({ roadmap }: { roadmap: RoadmapDto }) {
  return (
    <Card padded={false}>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionTitle}>Lộ trình học tập</Text>
        <Text style={styles.muted}>AI đề xuất</Text>
      </View>
      <View style={{ padding: Spacing.base, gap: 8 }}>
        {roadmap.steps.map((step, i) => {
          const isCompleted = step.status === 'completed';
          const isRecommended = step.status === 'recommended';
          const isLocked = step.status === 'locked';
          return (
            <View key={step.id} style={styles.stepRow}>
              <View style={[styles.stepIcon,
                isCompleted && { backgroundColor: Colors.success },
                isRecommended && { backgroundColor: Colors.primary },
                (!isCompleted && !isRecommended) && { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }
              ]}>
                {isCompleted ? <Ionicons name="checkmark" size={14} color={Colors.white} /> :
                  isLocked ? <Ionicons name="lock-closed" size={12} color={Colors.textMuted} /> :
                    <Text style={[styles.stepNum, isRecommended && { color: Colors.white }]}>{i + 1}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bodyText, isLocked && { color: Colors.textMuted }]}>{step.topicName}</Text>
                {step.reason && <Text style={styles.stepReason}>✨ {step.reason}</Text>}
                {!isLocked && step.progress > 0 && <ProgressBar value={step.progress} color={isCompleted ? 'success' : 'primary'} />}
              </View>
              {isRecommended && (
                <View style={styles.studyBtn}>
                  <Text style={styles.studyBtnText}>Học</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// ─── Class Detail View ────────────────────────────────────
function ClassDetail({ cls, onBack }: { cls: ClassDto; onBack: () => void }) {
  const [entryTestDone, setEntryTestDone] = useState(false);
  const { data: roadmap, refetch } = useQuery({
    queryKey: ['roadmap', cls.id],
    queryFn: () => roadmapService.getRoadmap(cls.id),
    retry: false,
  });

  const handleStartEntryTest = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push({ pathname: '/entry-test/[classId]', params: { classId: cls.id } } as any);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md }}>
      <View style={styles.row}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.classTitle}>{cls.name}</Text>
          <Text style={styles.muted}>{cls.description}</Text>
        </View>
      </View>

      {/* Progress */}
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.bodyText}>Tiến độ của bạn</Text>
          <Text style={{ color: Colors.primary, fontWeight: '700' }}>{cls.averageProgress}%</Text>
        </View>
        <ProgressBar value={cls.averageProgress} size="md" />
        <Text style={[styles.muted, { marginTop: 6 }]}>{cls.topicCount} topics</Text>
      </Card>

      {/* Entry test or roadmap */}
      {!roadmap && !entryTestDone ? (
        <View style={styles.entryBanner}>
          <View style={styles.row}>
            <View style={styles.entryIcon}>
              <Ionicons name="warning" size={20} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryTitle}>Bắt đầu bài test đầu vào</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>
                Hoàn thành để AI tạo lộ trình học tập cá nhân hoá
              </Text>
            </View>
          </View>
          <Button
            title="▶ Làm bài test"
            variant="outline"
            style={{ borderColor: 'rgba(255,255,255,0.4)', marginTop: 12 }}
            textStyle={{ color: Colors.white }}
            onPress={handleStartEntryTest}
          />
        </View>
      ) : roadmap ? (
        <RoadmapView roadmap={roadmap} />
      ) : (
        <Card style={{ alignItems: 'center', padding: Spacing.lg }}>
          <Ionicons name="sync" size={24} color={Colors.primary} />
          <Text style={[styles.muted, { marginTop: 8 }]}>AI đang tạo lộ trình...</Text>
        </Card>
      )}
    </ScrollView>
  );
}

// ─── Class Card ───────────────────────────────────────────
function ClassCard({ cls, onPress }: { cls: ClassDto; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.classCard} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.colorBar, { backgroundColor: cls.coverColor }]} />
      <View style={{ padding: Spacing.base }}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.className} numberOfLines={1}>{cls.name}</Text>
            <Text style={styles.muted} numberOfLines={1}>{cls.description}</Text>
          </View>
        </View>
        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ProgressBar value={cls.averageProgress} />
          <Text style={[styles.muted, { fontWeight: '700', width: 36 }]}>{cls.averageProgress}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Join Class Modal ─────────────────────────────────────
function JoinModal({ visible, onClose, onJoin }: { visible: boolean; onClose: () => void; onJoin: (code: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Tham gia lớp học</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.muted, { marginTop: 4 }]}>Nhập mã lớp học từ giáo viên</Text>
          <TextInput
            style={styles.codeInput}
            placeholder="Ví dụ: MATH2024"
            placeholderTextColor={Colors.textDisabled}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
          />
          <Button title="Tham gia" onPress={() => { onJoin(code); onClose(); }} disabled={code.length < 4} />
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function StudentClassesScreen() {
  const [selected, setSelected] = useState<ClassDto | null>(null);
  const [showJoin, setShowJoin] = useState(false);
  const qc = useQueryClient();

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['enrolled-classes'],
    queryFn: classesService.getEnrolledClasses,
  });

  const joinMut = useMutation({
    mutationFn: (code: string) => classesService.joinClass(code),
    onSuccess: (cls) => { Alert.alert('✅ Thành công', `Đã tham gia "${cls.name}"!`); qc.invalidateQueries({ queryKey: ['enrolled-classes'] }); },
    onError: (e) => Alert.alert('Lỗi', e.message),
  });

  if (selected) return (
    <SafeAreaView style={styles.safeArea}>
      <ClassDetail cls={selected} onBack={() => setSelected(null)} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <JoinModal visible={showJoin} onClose={() => setShowJoin(false)} onJoin={(code) => joinMut.mutate(code)} />
      <View style={styles.header}>
        <Text style={styles.appTitle}>Lớp học của tôi</Text>
        <Button title="+ Tham gia" size="sm" onPress={() => setShowJoin(true)} />
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md }}>
        <Text style={styles.muted}>{classes.length} lớp đã đăng ký</Text>
        {classes.map((cls) => (
          <ClassCard key={cls.id} cls={cls} onPress={() => setSelected(cls)} />
        ))}
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
  bodyText: { ...Typography.body, color: Colors.text, fontWeight: '500' },
  sectionTitle: { ...Typography.h4, color: Colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  classCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  classTitle: { ...Typography.h3, color: Colors.text },
  className: { ...Typography.h4, color: Colors.text },
  colorBar: { height: 5, width: '100%' },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  entryBanner: { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.base + 4 },
  entryIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  entryTitle: { ...Typography.h4, color: Colors.white },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  stepIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  stepReason: { ...Typography.captionSm, color: Colors.primary, marginTop: 2 },
  studyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  studyBtnText: { fontSize: 12, color: Colors.white, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: 14 },
  codeInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.base, paddingVertical: 12, color: Colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 3,
  },
});
