import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { classesService } from '../../services/classesService';
import { topicsService } from '../../services/topicsService';
import { quizzesService, type SubmitQuizRequest } from '../../services/quizzesService';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { Card } from '../../components/ui/Card';
import { DifficultyBadge } from '../../components/ui/DifficultyBadge';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { TopicDto, QuestionDto, QuizResultDto } from '../../types';

// ─── Quick Practice Modal ─────────────────────────────────────────────────────
function PracticeModal({
  visible,
  topic,
  onClose,
}: {
  visible: boolean;
  topic: TopicDto | null;
  onClose: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResultDto | null>(null);
  const [questionStart] = useState(Date.now());

  const { data: quiz, isLoading } = useQuery({
    queryKey: ['practice-quiz', topic?.id],
    queryFn: () => quizzesService.getPracticeQuiz(topic!.id, 10),
    enabled: !!topic?.id && visible,
  });

  const submitMutation = useMutation({
    mutationFn: (req: SubmitQuizRequest) =>
      quizzesService.submitPracticeQuiz(topic!.id, req),
    onSuccess: (res) => setResult(res),
    onError: (err: Error) => {
      Toast.show({ type: 'error', text1: 'Lỗi nộp bài', text2: err.message });
    },
  });

  const questions: QuestionDto[] = quiz?.questions ?? [];
  const current = questions[currentIdx];
  const selectedIds = answers[current?.id] ?? [];

  const handleReset = () => {
    setCurrentIdx(0);
    setAnswers({});
    setResult(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSelect = (optionId: string) => {
    if (!current) return;
    const existing = answers[current.id] ?? [];
    if (current.type === 'multi_select') {
      const updated = existing.includes(optionId)
        ? existing.filter((id) => id !== optionId)
        : [...existing, optionId];
      setAnswers((a) => ({ ...a, [current.id]: updated }));
    } else {
      setAnswers((a) => ({ ...a, [current.id]: [optionId] }));
    }
  };

  const handleNext = () => {
    const timeSpent = Math.round((Date.now() - questionStart) / 1000);
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      const req: SubmitQuizRequest = {
        answers: questions.map((q) => ({
          questionId: q.id,
          selectedOptionIds: answers[q.id] ?? [],
          timeSpentSeconds: timeSpent,
        })),
      };
      submitMutation.mutate(req);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.h4} numberOfLines={1}>{topic?.name}</Text>
            {!result && questions.length > 0 && (
              <Text style={styles.muted}>{currentIdx + 1}/{questions.length} câu hỏi</Text>
            )}
          </View>
          {!result && questions.length > 0 && (
            <DifficultyBadge difficulty={topic?.difficulty ?? 'medium'} />
          )}
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={[styles.muted, { marginTop: 8 }]}>Đang tải câu hỏi...</Text>
          </View>
        ) : result ? (
          // ── Kết quả ──
          <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, alignItems: 'center' }}>
            <View style={[styles.scoreCircle, {
              borderColor: result.percentage >= 70 ? Colors.success : result.percentage >= 50 ? Colors.warning : Colors.error
            }]}>
              <Text style={[styles.scoreNum, {
                color: result.percentage >= 70 ? Colors.success : result.percentage >= 50 ? Colors.warning : Colors.error
              }]}>{result.percentage}%</Text>
            </View>
            <Text style={styles.h3}>
              {result.percentage >= 80 ? '🎉 Xuất sắc!' : result.percentage >= 60 ? '👍 Tốt!' : '💪 Cần luyện thêm'}
            </Text>
            <Text style={styles.muted}>{result.score}/{result.total} câu đúng</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button title="Làm lại" variant="outline" onPress={handleReset} style={{ flex: 1 }} />
              <Button title="Đóng" onPress={handleClose} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        ) : (
          // ── Quiz ──
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, {
                width: `${questions.length > 0 ? (currentIdx / questions.length) * 100 : 0}%`
              }]} />
            </View>
            <ScrollView contentContainerStyle={{ padding: Spacing.base, gap: Spacing.lg }}>
              <View style={styles.questionCard}>
                <Text style={styles.questionText}>{current?.text}</Text>
              </View>
              <View style={{ gap: 10 }}>
                {current?.options.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.optionBtn, selectedIds.includes(opt.id) && styles.optionBtnSelected]}
                    onPress={() => handleSelect(opt.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionDot, selectedIds.includes(opt.id) && styles.optionDotSelected]}>
                      {selectedIds.includes(opt.id) && <View style={styles.optionDotInner} />}
                    </View>
                    <Text style={[styles.optionText, selectedIds.includes(opt.id) && { color: Colors.primary }]}>{opt.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.footer}>
              <Button
                title={currentIdx < questions.length - 1 ? 'Tiếp theo →' : '✅ Hoàn thành'}
                disabled={selectedIds.length === 0}
                loading={submitMutation.isPending}
                onPress={handleNext}
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Practice Screen ─────────────────────────────────────────────────────
export default function PracticeScreen() {
  const [selectedTopic, setSelectedTopic] = useState<TopicDto | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['enrolled-classes'],
    queryFn: classesService.getEnrolledClasses,
  });

  const { data: topics = [], isLoading: loadingTopics } = useQuery({
    queryKey: ['topics', selectedClassId],
    queryFn: () => topicsService.getTopics(selectedClassId!),
    enabled: !!selectedClassId,
  });

  // Auto-select first class
  React.useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <PracticeModal
        visible={!!selectedTopic}
        topic={selectedTopic}
        onClose={() => setSelectedTopic(null)}
      />

      <View style={styles.header}>
        <Text style={styles.appTitle}>Luyện tập</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md }}>
        {/* Class selector */}
        {classes.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Spacing.base }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.base }}>
              {classes.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.classChip, selectedClassId === cls.id && styles.classChipActive]}
                  onPress={() => setSelectedClassId(cls.id)}
                >
                  <View style={[styles.chipDot, { backgroundColor: cls.coverColor }]} />
                  <Text style={[styles.chipText, selectedClassId === cls.id && { color: Colors.primary }]}>
                    {cls.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        <Text style={styles.muted}>Chọn chủ đề để bắt đầu luyện tập</Text>

        {loadingClasses || loadingTopics ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
        ) : topics.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="book-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.muted}>
              {!selectedClassId ? 'Bạn chưa tham gia lớp học nào' : 'Lớp học chưa có topic'}
            </Text>
          </View>
        ) : (
          topics.map((topic) => (
            <TouchableOpacity
              key={topic.id}
              style={[styles.topicCard, topic.questionCount === 0 && { opacity: 0.5 }]}
              onPress={() => {
                if (topic.questionCount === 0) {
                  Toast.show({ type: 'info', text1: 'Chưa có câu hỏi', text2: 'Topic này chưa có quiz để luyện tập.' });
                  return;
                }
                setSelectedTopic(topic);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.topicIconBox, { backgroundColor: `${Colors.primary}12` }]}>
                <Ionicons name="book-outline" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.topicName}>{topic.name}</Text>
                <Text style={styles.muted}>
                  {topic.questionCount > 0 ? `${topic.questionCount} câu hỏi` : 'Chưa có câu hỏi'}
                </Text>
              </View>
              <DifficultyBadge difficulty={topic.difficulty} />
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  appTitle: { ...Typography.h3, color: Colors.text },
  muted: { ...Typography.caption, color: Colors.textMuted },
  h3: { ...Typography.h3, color: Colors.text },
  h4: { ...Typography.h4, color: Colors.text },
  topicCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.base,
  },
  topicIconBox: {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  topicName: { ...Typography.body, color: Colors.text, fontWeight: '600' },
  classChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  classChipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}10` },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { ...Typography.caption, color: Colors.textMuted, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: Spacing['2xl'] },
  // Modal styles
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 4, backgroundColor: Colors.surface },
  progressFill: { height: 4, backgroundColor: Colors.primary },
  questionCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg,
  },
  questionText: { ...Typography.body, color: Colors.text, lineHeight: 24 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.base,
  },
  optionBtnSelected: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}10` },
  optionDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  optionDotSelected: { borderColor: Colors.primary },
  optionDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  optionText: { ...Typography.body, color: Colors.text, flex: 1 },
  footer: {
    padding: Spacing.base, paddingBottom: Spacing.lg,
    backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  scoreCircle: {
    width: 130, height: 130, borderRadius: 65, borderWidth: 6,
    alignItems: 'center', justifyContent: 'center', marginVertical: Spacing.lg,
  },
  scoreNum: { fontSize: 38, fontWeight: '800' },
});
