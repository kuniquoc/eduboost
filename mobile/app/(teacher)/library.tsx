import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { documentsService } from '../../services/documentsService';
import { useAuthStore } from '../../store/authStore';
import { classesService } from '../../services/classesService';
import type { ClassDto, DocumentDto } from '../../types';

const STATUS_CONFIG = {
  ready:      { icon: 'checkmark-circle', color: Colors.success, label: 'Sẵn sàng' },
  processing: { icon: 'sync',             color: Colors.warning, label: 'AI đang xử lý...' },
  uploading:  { icon: 'cloud-upload',     color: Colors.primary, label: 'Đang tải lên' },
  error:      { icon: 'alert-circle',     color: Colors.error,   label: 'Lỗi' },
} as const;

// ─── Doc Card ──────────────────────────────────────────────────────────────────
function DocCard({
  doc,
  onGenerateQuiz,
  onDelete,
}: {
  doc: DocumentDto;
  onGenerateQuiz: () => void;
  onDelete: () => void;
}) {
  const cfg = STATUS_CONFIG[doc.status];
  return (
    <View style={styles.docCard}>
      <View style={styles.docIcon}>
        <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
        <View style={styles.row}>
          <Text style={styles.muted}>{doc.size}</Text>
          <Text style={styles.dot}>·</Text>
          <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
          <Text style={[styles.muted, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {doc.status === 'ready' && (
          <TouchableOpacity onPress={onGenerateQuiz} style={styles.actionBtn}>
            <Ionicons name="sparkles-outline" size={15} color={Colors.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onDelete} style={[styles.actionBtn, { backgroundColor: `${Colors.error}15` }]}>
          <Ionicons name="trash-outline" size={15} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Class Picker ─────────────────────────────────────────────────────────────
function ClassPicker({
  classes,
  selected,
  onSelect,
}: {
  classes: ClassDto[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <Text style={[styles.muted, { marginBottom: 8 }]}>Chọn lớp học</Text>
      {classes.map((cls) => (
        <TouchableOpacity
          key={cls.id}
          style={[styles.classOption, selected === cls.id && styles.classOptionActive]}
          onPress={() => onSelect(cls.id)}
        >
          <View style={[styles.colorDot, { backgroundColor: cls.coverColor }]} />
          <Text style={{ ...Typography.body, color: Colors.text }}>{cls.name}</Text>
          {selected === cls.id && (
            <Ionicons name="checkmark" size={16} color={Colors.primary} style={{ marginLeft: 'auto' }} />
          )}
        </TouchableOpacity>
      ))}
      {classes.length === 0 && (
        <Text style={styles.muted}>Bạn chưa có lớp học nào</Text>
      )}
    </Card>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LibraryScreen() {
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [uploadingName, setUploadingName] = useState<string | null>(null);

  // Lấy danh sách lớp để chọn khi upload
  const { data: classes = [] } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: classesService.getTeacherClasses,
  });

  // Lấy tài liệu theo lớp đang chọn
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['class-documents', selectedClassId],
    queryFn: () => documentsService.getClassDocuments(selectedClassId!),
    enabled: !!selectedClassId,
  });

  // Generate quiz từ document
  const generateQuizMutation = useMutation({
    mutationFn: ({ docId, topicId }: { docId: string; topicId: string }) =>
      documentsService.generateQuizFromDocument(selectedClassId!, docId, { topicId }),
    onSuccess: (job) => {
      Alert.alert(
        '✨ Đã gửi yêu cầu',
        `AI đang tạo quiz (Job: ${job.jobId}). Kiểm tra lại sau vài phút.`
      );
      queryClient.invalidateQueries({ queryKey: ['class-documents', selectedClassId] });
    },
    onError: (err: Error) => Alert.alert('Lỗi', err.message),
  });

  // Xoá document
  const deleteMutation = useMutation({
    mutationFn: (docId: string) =>
      documentsService.deleteClassDocument(selectedClassId!, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-documents', selectedClassId] });
    },
    onError: (err: Error) => Alert.alert('Lỗi xoá tài liệu', err.message),
  });

  const handleUpload = async () => {
    if (!selectedClassId) {
      Alert.alert('Chưa chọn lớp', 'Vui lòng chọn lớp học trước khi upload tài liệu');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain', 'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    if (result.canceled) return;

    const file = result.assets[0];
    setUploadingName(file.name);

    try {
      // Bước 1: Lấy presigned URL
      const { uploadUrl, documentId } = await documentsService.requestClassUploadUrl(
        selectedClassId,
        {
          fileName: file.name,
          contentType: file.mimeType ?? 'application/octet-stream',
        }
      );

      // Bước 2: PUT lên MinIO
      await documentsService.uploadFileToMinio(uploadUrl, file.uri, file.mimeType ?? 'application/octet-stream');

      // Bước 3: Confirm
      await documentsService.confirmClassUpload(selectedClassId, { documentId });

      queryClient.invalidateQueries({ queryKey: ['class-documents', selectedClassId] });
      Alert.alert('✅ Thành công', `Đã upload "${file.name}"`);
    } catch (err: any) {
      Alert.alert('Upload thất bại', err.message ?? 'Vui lòng thử lại');
    } finally {
      setUploadingName(null);
    }
  };

  const handleGenerateQuiz = (doc: DocumentDto) => {
    if (!doc.topicId) {
      Alert.alert('Chưa gắn topic', 'Document này chưa được gắn với topic nào. Hãy gắn topic trước.');
      return;
    }
    Alert.alert(
      '✨ Tạo Quiz AI',
      `Tạo quiz từ "${doc.name}"?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Tạo',
          onPress: () => generateQuizMutation.mutate({ docId: doc.id, topicId: doc.topicId! }),
        },
      ]
    );
  };

  const handleDelete = (doc: DocumentDto) => {
    Alert.alert(
      'Xoá tài liệu',
      `Xoá "${doc.name}"? Hành động này không thể hoàn tác.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xoá', style: 'destructive', onPress: () => deleteMutation.mutate(doc.id) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>Thư viện Tài liệu</Text>
        <Button
          title={uploadingName ? 'Đang tải...' : 'Upload'}
          size="sm"
          onPress={handleUpload}
          disabled={!!uploadingName}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md }}>
        {/* Upload progress indicator */}
        {uploadingName && (
          <View style={styles.uploadProgress}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.muted}>Đang upload: {uploadingName}</Text>
          </View>
        )}

        {/* Class picker */}
        <ClassPicker
          classes={classes}
          selected={selectedClassId}
          onSelect={setSelectedClassId}
        />

        {/* Documents list */}
        {selectedClassId ? (
          isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
          ) : docs.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.muted}>Chưa có tài liệu. Nhấn Upload để thêm.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.muted}>{docs.length} tài liệu</Text>
              {docs.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onGenerateQuiz={() => handleGenerateQuiz(doc)}
                  onDelete={() => handleDelete(doc)}
                />
              ))}
            </>
          )
        ) : (
          <View style={styles.empty}>
            <Ionicons name="book-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.muted}>Chọn lớp học để xem tài liệu</Text>
          </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  dot: { color: Colors.border },
  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  docIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: `${Colors.primary}15`, alignItems: 'center', justifyContent: 'center',
  },
  docName: { ...Typography.body, color: Colors.text, fontWeight: '500' },
  actionBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: `${Colors.primary}15`, alignItems: 'center', justifyContent: 'center',
  },
  uploadProgress: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: `${Colors.primary}10`, borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  classOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: Spacing.md, borderRadius: Radius.md, marginBottom: 4,
  },
  classOptionActive: { backgroundColor: `${Colors.primary}15` },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  empty: {
    alignItems: 'center', gap: 12,
    paddingVertical: Spacing['2xl'],
  },
});
