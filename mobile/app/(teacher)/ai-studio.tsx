import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { classesService } from '../../services/classesService';
import { documentsService } from '../../services/documentsService';
import { quizzesService } from '../../services/quizzesService';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DifficultyBadge } from '../../components/ui/DifficultyBadge';
import type { QuestionDto } from '../../types';

type StudioStep = 'upload' | 'processing' | 'editor';

// ─── Question Editor Card ─────────────────────────────────
function QuestionEditorCard({
  question,
  onToggleVerified,
  onDelete,
}: {
  question: QuestionDto;
  onToggleVerified: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card padded={false} style={question.verifiedByTeacher ? { borderColor: `${Colors.success}40` } : {}}>
      <View style={{ padding: Spacing.base }}>
        <View style={styles.row}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeLabel}>
              {question.type === 'mcq' ? 'Trắc nghiệm' : question.type === 'multi_select' ? 'Nhiều lựa chọn' : 'Điền vào chỗ trống'}
            </Text>
          </View>
          <DifficultyBadge difficulty={question.difficulty} />
          {question.verifiedByTeacher && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
              <Text style={styles.verifiedLabel}>Đã duyệt</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <Text style={styles.questionText}>{question.text}</Text>
        </TouchableOpacity>

        {expanded && question.options.length > 0 && (
          <View style={{ gap: 6, marginTop: 10 }}>
            {question.options.map((opt) => (
              <View key={opt.id} style={[styles.optionRow, opt.isCorrect && styles.optionCorrect]}>
                <Ionicons
                  name={opt.isCorrect ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={opt.isCorrect ? Colors.success : Colors.textMuted}
                />
                <Text style={[styles.optionText, opt.isCorrect && { color: Colors.success }]}>{opt.text}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <TouchableOpacity onPress={() => onToggleVerified(question.id)} style={styles.row}>
          <Ionicons
            name={question.verifiedByTeacher ? 'checkbox' : 'checkbox-outline'}
            size={16}
            color={question.verifiedByTeacher ? Colors.success : Colors.textMuted}
          />
          <Text style={[styles.footerBtn, question.verifiedByTeacher && { color: Colors.success }]}>
            {question.verifiedByTeacher ? 'Đã duyệt' : 'Duyệt'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(question.id)}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ─── Main AI Studio Screen ────────────────────────────────
export default function AIStudioScreen() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<StudioStep>('upload');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: classes = [] } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: classesService.getTeacherClasses,
  });

  const fakeProgress = (name: string, onDone: () => void) => {
    setFileName(name);
    setStep('processing');
    setProgress(0);
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(intervalRef.current!);
          setTimeout(onDone, 400);
          return 100;
        }
        return p + 7;
      });
    }, 100);
  };

  const pickDocument = async () => {
    if (!selectedClass) {
      Alert.alert('Chưa chọn lớp', 'Vui lòng chọn lớp học trước');
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain',
             'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    if (result.canceled) return;

    const file = result.assets[0];

    fakeProgress(file.name, async () => {
      try {
        // Bước 1: request presigned URL
        const { uploadUrl, documentId } = await documentsService.requestClassUploadUrl(
          selectedClass,
          { fileName: file.name, contentType: file.mimeType ?? 'application/octet-stream' }
        );
        // Bước 2: upload lên MinIO
        await documentsService.uploadFileToMinio(uploadUrl, file.uri, file.mimeType ?? 'application/octet-stream');
        // Bước 3: confirm + generate quiz
        const doc = await documentsService.confirmClassUpload(selectedClass, { documentId });
        setActiveDocId(doc.id);

        if (doc.topicId) {
          const job = await documentsService.generateQuizFromDocument(
            selectedClass, doc.id, { topicId: doc.topicId }
          );
          // Poll nếu cần — hiện tại load questions ngay
          setActiveQuizId(job.jobId);
        }

        // Load questions (sử dụng quizId nếu có, hoặc empty)
        setStep('editor');
        setQuestions([]);
      } catch (err: any) {
        Alert.alert('Lỗi xử lý', err.message ?? 'AI có lỗi, vui lòng thử lại');
        setStep('upload');
      }
    });
  };

  if (step === 'upload') return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>AI Quiz Studio</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md }}>
        <View style={styles.uploadZone}>
          <View style={styles.uploadIcon}>
            <Ionicons name="cloud-upload-outline" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.uploadTitle}>Upload Tài liệu</Text>
          <Text style={styles.muted}>PDF, DOCX hoặc TXT — tối đa 50MB</Text>
          <Button title="Chọn File" onPress={pickDocument} style={{ marginTop: 8 }} />
        </View>

        <Card>
          <Text style={[styles.muted, { marginBottom: 8 }]}>Publish vào lớp học</Text>
          {classes.map((cls) => (
            <TouchableOpacity
              key={cls.id}
              style={[styles.classOption, selectedClass === cls.id && styles.classOptionSelected]}
              onPress={() => setSelectedClass(cls.id)}
            >
              <View style={[styles.colorDot, { backgroundColor: cls.coverColor }]} />
              <Text style={{ ...Typography.body, color: Colors.text }}>{cls.name}</Text>
              {selectedClass === cls.id && <Ionicons name="checkmark" size={16} color={Colors.primary} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );

  if (step === 'processing') return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.center, { padding: Spacing['2xl'] }]}>
        <View style={styles.processingCircle}>
          <Ionicons name="sparkles" size={36} color={Colors.primary} />
        </View>
        <Text style={[styles.appTitle, { marginTop: 20 }]}>AI đang phân tích...</Text>
        <Text style={[styles.muted, { textAlign: 'center', marginTop: 6 }]}>
          Đang tạo quiz từ {'\n'}<Text style={{ color: Colors.text, fontWeight: '600' }}>{fileName}</Text>
        </Text>
        <View style={{ width: '100%', marginTop: 28 }}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 6 }]}>{progress}%</Text>
        </View>
        {progress > 25 && <Text style={{ color: Colors.success, marginTop: 8, fontSize: 12 }}>✓ Phân tích cấu trúc...</Text>}
        {progress > 55 && <Text style={{ color: Colors.success, fontSize: 12 }}>✓ Xác định khái niệm chính...</Text>}
        {progress > 80 && <Text style={{ color: Colors.success, fontSize: 12 }}>✓ Đang tạo câu hỏi đa dạng...</Text>}
      </View>
    </SafeAreaView>
  );

  // Editor step
  const verifiedCount = questions.filter((q) => q.verifiedByTeacher).length;

  const handleVerify = async (id: string) => {
    const q = questions.find((x) => x.id === id);
    if (!q || !activeQuizId) {
      // Local-only toggle khi chưa có quizId thật
      setQuestions((qs) => qs.map((x) => x.id === id ? { ...x, verifiedByTeacher: !x.verifiedByTeacher } : x));
      return;
    }
    try {
      const updated = await quizzesService.verifyQuestion(activeQuizId, id, !q.verifiedByTeacher);
      setQuestions((qs) => qs.map((x) => x.id === id ? updated : x));
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (activeQuizId) {
      try {
        await quizzesService.deleteQuestion(activeQuizId, id);
      } catch { /* ignore */ }
    }
    setQuestions((qs) => qs.filter((x) => x.id !== id));
  };

  const handlePublish = async () => {
    if (!activeQuizId) {
      Alert.alert('✅ Demo', `Đã publish ${verifiedCount} câu hỏi! (Demo mode - chưa có quizId thật)`);
      return;
    }
    try {
      await quizzesService.publishQuiz(activeQuizId);
      Alert.alert('✅ Thành công', `Đã publish ${verifiedCount} câu hỏi lên lớp học!`);
      setStep('upload');
      setQuestions([]);
      setActiveQuizId(null);
    } catch (err: any) {
      Alert.alert('Lỗi publish', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>Kiểm duyệt Câu hỏi</Text>
        <TouchableOpacity onPress={() => { setStep('upload'); setQuestions([]); setActiveQuizId(null); }}>
          <Ionicons name="refresh" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: Spacing.base, marginBottom: 8 }}>
        <Text style={styles.muted}>{verifiedCount}/{questions.length} đã duyệt</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${questions.length ? (verifiedCount / questions.length) * 100 : 0}%`, backgroundColor: Colors.success }]} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md, paddingBottom: 100 }}>
        {questions.map((q) => (
          <QuestionEditorCard
            key={q.id}
            question={q}
            onToggleVerified={handleVerify}
            onDelete={handleDelete}
          />
        ))}
        {questions.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.muted}>AI đang tạo câu hỏi...</Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.publishBar}>
        <Button
          title={`Publish ${verifiedCount} câu hỏi lên lớp`}
          disabled={verifiedCount === 0}
          onPress={handlePublish}
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  appTitle: { ...Typography.h3, color: Colors.text },
  muted: { ...Typography.caption, color: Colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  uploadZone: {
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    borderRadius: Radius.xl, padding: Spacing['2xl'], alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface,
  },
  uploadIcon: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: `${Colors.primary}15`, alignItems: 'center', justifyContent: 'center',
  },
  uploadTitle: { ...Typography.h4, color: Colors.text },
  classOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: Spacing.md, borderRadius: Radius.md, marginBottom: 4,
  },
  classOptionSelected: { backgroundColor: `${Colors.primary}15` },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  processingCircle: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: `${Colors.primary}15`, alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: {
    height: 6, backgroundColor: Colors.surface, borderRadius: 99, overflow: 'hidden', marginTop: 8,
  },
  progressFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 99 },
  typeBadge: { backgroundColor: Colors.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeLabel: { ...Typography.captionSm, color: Colors.textMuted, fontWeight: '500' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${Colors.success}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  verifiedLabel: { fontSize: 10, color: Colors.success, fontWeight: '600' },
  questionText: { ...Typography.body, color: Colors.text, marginTop: 8, lineHeight: 22 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, backgroundColor: Colors.surface },
  optionCorrect: { backgroundColor: `${Colors.success}15` },
  optionText: { ...Typography.bodySm, color: Colors.textMuted, flex: 1 },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface,
  },
  footerBtn: { ...Typography.caption, color: Colors.textMuted, fontWeight: '500' },
  publishBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.base, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border,
  },
});
