import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { documentsService } from '../../services/documentsService';
import { quizzesService } from '../../services/quizzesService';
import type { DocumentDto } from '../../types';

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  ready:      { icon: 'checkmark-circle', color: Colors.success, label: 'Sẵn sàng' },
  processing: { icon: 'sync',             color: Colors.warning, label: 'AI đang xử lý' },
  uploading:  { icon: 'cloud-upload',     color: Colors.primary, label: 'Đang tải lên' },
  error:      { icon: 'alert-circle',     color: Colors.error,   label: 'Lỗi' },
} as const;

export default function AILabScreen() {
  const queryClient = useQueryClient();
  const [uploadingName, setUploadingName] = useState<string | null>(null);

  // Lấy danh sách tài liệu riêng của student
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['my-documents'],
    queryFn: documentsService.getMyDocuments,
  });

  // Xoá tài liệu
  const deleteMutation = useMutation({
    mutationFn: (docId: string) => documentsService.deleteMyDocument(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-documents'] });
      Toast.show({ type: 'success', text1: 'Đã xoá tài liệu' });
    },
    onError: (err: Error) => Toast.show({ type: 'error', text1: 'Lỗi xoá', text2: err.message }),
  });

  // Generate quiz riêng
  const generateMutation = useMutation({
    mutationFn: (docId: string) => documentsService.generateMyQuiz(docId),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['my-documents'] });
      Toast.show({
        type: 'success',
        text1: '✨ AI đang tạo quiz',
        text2: `Job ${job.jobId} — kiểm tra lại sau vài phút`,
      });
    },
    onError: (err: Error) => Toast.show({ type: 'error', text1: 'Lỗi tạo quiz', text2: err.message }),
  });

  const handleUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain',
             'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    if (result.canceled) return;

    const file = result.assets[0];
    setUploadingName(file.name);

    try {
      // Bước 1: Lấy presigned URL
      const { uploadUrl, documentId } = await documentsService.requestStudentUploadUrl({
        fileName: file.name,
        contentType: file.mimeType ?? 'application/octet-stream',
      });

      // Bước 2: PUT lên MinIO
      await documentsService.uploadFileToMinio(uploadUrl, file.uri, file.mimeType ?? 'application/octet-stream');

      // Bước 3: Confirm
      await documentsService.confirmStudentUpload({ documentId });

      queryClient.invalidateQueries({ queryKey: ['my-documents'] });
      Toast.show({ type: 'success', text1: '✅ Upload thành công', text2: file.name });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Upload thất bại', text2: err.message });
    } finally {
      setUploadingName(null);
    }
  };

  const handleDelete = (doc: DocumentDto) => {
    Alert.alert(
      'Xoá tài liệu',
      `Xoá "${doc.name}"? Hành động không thể hoàn tác.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xoá', style: 'destructive', onPress: () => deleteMutation.mutate(doc.id) },
      ]
    );
  };

  // Phân loại docs: có quiz và chưa có
  const docsWithQuiz = docs.filter((d) => d.generatedQuizId);
  const docsWithoutQuiz = docs.filter((d) => !d.generatedQuizId && d.status === 'ready');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Banner */}
        <View style={styles.introBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Ionicons name="flask" size={22} color={Colors.white} />
            <Text style={styles.introTitle}>AI Lab cá nhân</Text>
          </View>
          <Text style={styles.introDesc}>Upload tài liệu — AI tạo quiz riêng cho bạn.</Text>
          <Button
            title={uploadingName ? `Đang upload...` : '+ Upload Tài liệu'}
            variant="outline"
            style={{ borderColor: 'rgba(255,255,255,0.4)', marginTop: 12 }}
            textStyle={{ color: Colors.white }}
            onPress={handleUpload}
            disabled={!!uploadingName}
          />
        </View>

        <View style={{ padding: Spacing.base, gap: Spacing.md }}>
          {/* Upload progress */}
          {uploadingName && (
            <View style={styles.uploadProgress}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.muted}>Đang upload: {uploadingName}</Text>
            </View>
          )}

          {/* Documents list */}
          <Card padded={false}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>Tài liệu của tôi</Text>
              <Text style={styles.muted}>{docs.length} tài liệu</Text>
            </View>

            {isLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ margin: Spacing.lg }} />
            ) : docs.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="document-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.muted}>Chưa có tài liệu. Nhấn Upload để thêm.</Text>
              </View>
            ) : (
              <View style={{ padding: Spacing.sm, gap: 8 }}>
                {docs.map((doc) => {
                  const cfg = STATUS_CFG[doc.status];
                  return (
                    <View key={doc.id} style={styles.docRow}>
                      <View style={styles.docIcon}>
                        <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Text style={styles.muted}>{doc.size}</Text>
                          <Text style={styles.dot}>·</Text>
                          <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
                          <Text style={[styles.muted, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {doc.status === 'ready' && !doc.generatedQuizId && (
                          <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={() => generateMutation.mutate(doc.id)}
                            disabled={generateMutation.isPending}
                          >
                            <Ionicons name="sparkles-outline" size={15} color={Colors.primary} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.iconBtn, { backgroundColor: `${Colors.error}12` }]}
                          onPress={() => handleDelete(doc)}
                        >
                          <Ionicons name="trash-outline" size={15} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          {/* Quiz cá nhân */}
          {docsWithQuiz.length > 0 && (
            <Card padded={false}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionTitle}>Quiz cá nhân</Text>
                <Text style={styles.muted}>{docsWithQuiz.length} quiz</Text>
              </View>
              <View style={{ padding: Spacing.sm, gap: 8 }}>
                {docsWithQuiz.map((doc) => (
                  <View key={doc.id} style={styles.docRow}>
                    <View style={[styles.docIcon, { backgroundColor: `${Colors.success}12` }]}>
                      <Ionicons name="flask-outline" size={16} color={Colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                      <Text style={styles.muted}>{doc.uploadedAt}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: `${Colors.primary}15` }]}
                      onPress={() =>
                        Toast.show({ type: 'info', text1: 'Coming soon', text2: 'Quiz editor đang được phát triển' })
                      }
                    >
                      <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* CTA nếu có docs chưa gen quiz */}
          {docsWithoutQuiz.length > 0 && (
            <View style={styles.ctaBanner}>
              <Ionicons name="sparkles" size={18} color={Colors.primary} />
              <Text style={[styles.muted, { flex: 1 }]}>
                Bạn có {docsWithoutQuiz.length} tài liệu chưa có quiz.
              </Text>
              <TouchableOpacity
                onPress={() => docsWithoutQuiz.forEach((d) => generateMutation.mutate(d.id))}
              >
                <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 13 }}>Tạo ngay</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  introBanner: {
    backgroundColor: Colors.primary, margin: Spacing.base,
    borderRadius: Radius.xl, padding: Spacing.lg,
  },
  introTitle: { ...Typography.h3, color: Colors.white },
  introDesc: { ...Typography.body, color: 'rgba(255,255,255,0.85)' },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sectionTitle: { ...Typography.h4, color: Colors.text },
  muted: { ...Typography.caption, color: Colors.textMuted },
  dot: { color: Colors.border },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  docIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: `${Colors.primary}15`, alignItems: 'center', justifyContent: 'center' },
  docName: { ...Typography.body, color: Colors.text, fontWeight: '500' },
  iconBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  uploadProgress: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: `${Colors.primary}10`, borderRadius: Radius.lg, padding: Spacing.md,
  },
  empty: { alignItems: 'center', gap: 10, padding: Spacing.xl },
  ctaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: `${Colors.primary}10`, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: `${Colors.primary}25`,
  },
});
