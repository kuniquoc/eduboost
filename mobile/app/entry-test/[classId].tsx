import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { quizzesService, type SubmitQuizRequest } from '../../services/quizzesService';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { QuestionDto, QuizAnswer, QuizResultDto } from '../../types';

// ─── Option Button ────────────────────────────────────────────────────────────
function OptionBtn({
  text,
  selected,
  onPress,
}: {
  text: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionBtn, selected && styles.optionBtnSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.optionDot, selected && styles.optionDotSelected]}>
        {selected && <View style={styles.optionDotInner} />}
      </View>
      <Text style={[styles.optionText, selected && { color: Colors.primary }]}>{text}</Text>
    </TouchableOpacity>
  );
}

// ─── Result Screen ────────────────────────────────────────────────────────────
function ResultScreen({
  result,
  onClose,
}: {
  result: QuizResultDto;
  onClose: () => void;
}) {
  const gradeColor =
    result.percentage >= 80 ? Colors.success :
    result.percentage >= 60 ? Colors.warning : Colors.error;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, alignItems: 'center' }}>
        {/* Score Circle */}
        <View style={[styles.scoreCircle, { borderColor: gradeColor }]}>
          <Text style={[styles.scoreNum, { color: gradeColor }]}>{result.percentage}%</Text>
          <Text style={[styles.scoreLbl, { color: gradeColor }]}>{result.grade}</Text>
        </View>

        <Text style={styles.resultTitle}>
          {result.percentage >= 80 ? '🎉 Xuất sắc!' :
           result.percentage >= 60 ? '👍 Tốt lắm!' : '💪 Cần cải thiện'}
        </Text>
        <Text style={styles.muted}>
          {result.score}/{result.total} câu đúng
        </Text>

        {/* Topic breakdown */}
        {result.topicScores.length > 0 && (
          <View style={styles.topicBreakdown}>
            <Text style={styles.sectionTitle}>Điểm theo chủ đề</Text>
            {result.topicScores.map((ts) => (
              <View key={ts.topicId} style={styles.topicRow}>
                <Text style={styles.topicName} numberOfLines={1}>{ts.topicName}</Text>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <ProgressBar
                    value={ts.percentage}
                    color={ts.percentage >= 70 ? 'success' : ts.percentage >= 50 ? 'warning' : 'error'}
                  />
                </View>
                <Text style={[styles.muted, { fontWeight: '700', width: 38, textAlign: 'right' }]}>
                  {ts.percentage}%
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.roadmapCta}>
          <Ionicons name="map-outline" size={24} color={Colors.primary} />
          <Text style={styles.roadmapCtaTitle}>Lộ trình học tập</Text>
          <Text style={styles.muted}>
            Lộ trình cá nhân đã được tạo tự động sau khi nộp bài
          </Text>
          <Button
            title="Xem lộ trình"
            onPress={onClose}
            style={{ width: '100%', marginTop: 8 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Main Entry Test Screen ───────────────────────────────────────────────────
export default function EntryTestScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
  const [result, setResult] = useState<QuizResultDto | null>(null);
  const [startTime] = useState(Date.now());
  const [questionStart, setQuestionStart] = useState(Date.now());

  const progressAnim = useRef(new Animated.Value(0)).current;

  // Load entry test
  const { data: test, isLoading, error } = useQuery({
    queryKey: ['entry-test', classId],
    queryFn: () => quizzesService.getEntryTest(classId),
    retry: 1,
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (req: SubmitQuizRequest) =>
      quizzesService.submitEntryTest(classId, req),
    onSuccess: (res) => {
      setResult(res);
    },
    onError: (err: Error) => {
      Toast.show({ type: 'error', text1: 'Lỗi nộp bài', text2: err.message });
    },
  });

  const questions: QuestionDto[] = test?.questions ?? [];
  const current = questions[currentIdx];

  // Animate progress bar
  const animateProgress = useCallback((toValue: number) => {
    Animated.timing(progressAnim, {
      toValue,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [progressAnim]);

  const handleSelect = (optionId: string) => {
    if (!current) return;
    const existing = answers[current.id];
    if (current.type === 'multi_select') {
      const ids = existing?.selectedOptionIds ?? [];
      const updated = ids.includes(optionId)
        ? ids.filter((id) => id !== optionId)
        : [...ids, optionId];
      setAnswers((a) => ({ ...a, [current.id]: { ...existing, questionId: current.id, selectedOptionIds: updated, state: 'unanswered', timeSpentSeconds: 0, fillBlankValue: undefined } }));
    } else {
      setAnswers((a) => ({ ...a, [current.id]: { questionId: current.id, selectedOptionIds: [optionId], state: 'unanswered', timeSpentSeconds: 0, fillBlankValue: undefined } }));
    }
  };

  const handleNext = () => {
    const timeSpent = Math.round((Date.now() - questionStart) / 1000);
    setAnswers((a) => ({
      ...a,
      [current.id]: { ...(a[current.id] ?? { questionId: current.id, selectedOptionIds: [], state: 'unanswered', fillBlankValue: undefined }), timeSpentSeconds: timeSpent },
    }));

    if (currentIdx < questions.length - 1) {
      animateProgress((currentIdx + 1) / questions.length);
      setCurrentIdx((i) => i + 1);
      setQuestionStart(Date.now());
    } else {
      handleSubmit(timeSpent);
    }
  };

  const handleSubmit = (lastTimeSpent?: number) => {
    const req: SubmitQuizRequest = {
      answers: questions.map((q) => {
        const ans = answers[q.id];
        return {
          questionId: q.id,
          selectedOptionIds: ans?.selectedOptionIds ?? [],
          fillBlankValue: ans?.fillBlankValue,
          timeSpentSeconds: q.id === current?.id ? (lastTimeSpent ?? 0) : (ans?.timeSpentSeconds ?? 0),
        };
      }),
    };
    submitMutation.mutate(req);
  };

  // ── Loading ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.muted, { marginTop: 12 }]}>Đang tải bài test...</Text>
      </SafeAreaView>
    );
  }

  if (error || !test) {
    return (
      <SafeAreaView style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center', padding: Spacing.lg }]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={[styles.sectionTitle, { marginTop: 12, textAlign: 'center' }]}>
          Lớp học chưa có bài test đầu vào
        </Text>
        <Text style={[styles.muted, { textAlign: 'center', marginTop: 6 }]}>
          Giáo viên chưa publish quiz entry test cho lớp này
        </Text>
        <Button title="Quay lại" onPress={() => router.back()} style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  // ── Result screen ──────────────────────────────────────────
  if (result) {
    return (
      <ResultScreen
        result={result}
        onClose={() => router.replace('/(student)/classes')}
      />
    );
  }

  // ── Quiz screen ────────────────────────────────────────────
  const selectedIds = answers[current?.id]?.selectedOptionIds ?? [];
  const hasAnswer = selectedIds.length > 0;
  const progress = questions.length > 0 ? (currentIdx / questions.length) : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.quizHeader}>
        <TouchableOpacity
          onPress={() => Alert.alert('Thoát bài test', 'Tiến độ sẽ không được lưu', [
            { text: 'Ở lại', style: 'cancel' },
            { text: 'Thoát', style: 'destructive', onPress: () => router.back() },
          ])}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.testTitle}>{test.className} — Test đầu vào</Text>
          <Text style={styles.muted}>{currentIdx + 1}/{questions.length} câu hỏi</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.base, gap: Spacing.lg }}>
        {/* Question */}
        <View style={styles.questionCard}>
          <View style={styles.questionBadge}>
            <Text style={styles.questionBadgeText}>
              {current.type === 'mcq' ? 'Trắc nghiệm' :
               current.type === 'multi_select' ? 'Nhiều đáp án' : 'Điền vào chỗ trống'}
            </Text>
          </View>
          <Text style={styles.questionText}>{current.text}</Text>
        </View>

        {/* Options */}
        <View style={{ gap: 10 }}>
          {current.options.map((opt) => (
            <OptionBtn
              key={opt.id}
              text={opt.text}
              selected={selectedIds.includes(opt.id)}
              onPress={() => handleSelect(opt.id)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title={currentIdx < questions.length - 1 ? 'Câu tiếp theo →' : '✅ Nộp bài'}
          disabled={!hasAnswer}
          loading={submitMutation.isPending}
          onPress={handleNext}
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  quizHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  testTitle: { ...Typography.bodySm, color: Colors.text, fontWeight: '600' },
  muted: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  progressTrack: { height: 4, backgroundColor: Colors.surface },
  progressFill: { height: 4, backgroundColor: Colors.primary },
  questionCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: 10,
  },
  questionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${Colors.primary}15`,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  questionBadgeText: { ...Typography.captionSm, color: Colors.primary, fontWeight: '600' },
  questionText: { ...Typography.body, color: Colors.text, lineHeight: 24 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.base,
  },
  optionBtnSelected: {
    borderColor: Colors.primary, backgroundColor: `${Colors.primary}10`,
  },
  optionDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  optionDotSelected: { borderColor: Colors.primary },
  optionDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  optionText: { ...Typography.body, color: Colors.text, flex: 1 },
  footer: {
    flexDirection: 'row', padding: Spacing.base,
    paddingBottom: Spacing.lg, gap: 10,
    backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  // Result styles
  scoreCircle: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 6, alignItems: 'center', justifyContent: 'center',
    marginVertical: Spacing.lg,
  },
  scoreNum: { fontSize: 40, fontWeight: '800' },
  scoreLbl: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  resultTitle: { ...Typography.h2, color: Colors.text },
  topicBreakdown: {
    width: '100%', backgroundColor: Colors.card,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.base, gap: 12,
  },
  sectionTitle: { ...Typography.h4, color: Colors.text },
  topicRow: { flexDirection: 'row', alignItems: 'center' },
  topicName: { ...Typography.caption, color: Colors.text, width: 90 },
  roadmapCta: {
    width: '100%', backgroundColor: `${Colors.primary}10`,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: `${Colors.primary}30`,
    padding: Spacing.lg, alignItems: 'center', gap: 8,
  },
  roadmapCtaTitle: { ...Typography.h4, color: Colors.text },
});
