import { apiClient } from './api';
import type { ApiResponse, DocumentDto, UploadUrlDto, DownloadUrlDto, GenerateQuizJobDto } from '@/types';

interface RequestUploadUrlPayload {
  fileName: string;
  contentType: string;
  topicId?: string;
}

export const documentsService = {
  // ── Class documents (Teacher) ───────────────────────────
  getClassDocuments: async (classId: string): Promise<DocumentDto[]> => {
    const res = await apiClient.get<ApiResponse<DocumentDto[]>>(`/classes/${classId}/documents`);
    return res.data.data!;
  },

  requestClassUploadUrl: async (classId: string, payload: RequestUploadUrlPayload): Promise<UploadUrlDto> => {
    const res = await apiClient.post<ApiResponse<UploadUrlDto>>(`/classes/${classId}/documents/request-upload`, payload);
    return res.data.data!;
  },

  confirmClassUpload: async (classId: string, documentId: string): Promise<DocumentDto> => {
    const res = await apiClient.post<ApiResponse<DocumentDto>>(`/classes/${classId}/documents/confirm`, { documentId });
    return res.data.data!;
  },

  getClassDocumentDownloadUrl: async (classId: string, documentId: string): Promise<DownloadUrlDto> => {
    const res = await apiClient.get<ApiResponse<DownloadUrlDto>>(`/classes/${classId}/documents/${documentId}/download`);
    return res.data.data!;
  },

  deleteClassDocument: async (classId: string, documentId: string): Promise<void> => {
    await apiClient.delete(`/classes/${classId}/documents/${documentId}`);
  },

  generateQuizFromDocument: async (classId: string, documentId: string, topicId?: string): Promise<GenerateQuizJobDto> => {
    const res = await apiClient.post<ApiResponse<GenerateQuizJobDto>>(`/classes/${classId}/documents/${documentId}/generate-quiz`, { topicId });
    return res.data.data!;
  },

  // ── Student private documents ───────────────────────────
  getMyDocuments: async (): Promise<DocumentDto[]> => {
    const res = await apiClient.get<ApiResponse<DocumentDto[]>>('/documents/my');
    return res.data.data!;
  },

  requestStudentUploadUrl: async (payload: RequestUploadUrlPayload): Promise<UploadUrlDto> => {
    const res = await apiClient.post<ApiResponse<UploadUrlDto>>('/documents/my/request-upload', payload);
    return res.data.data!;
  },

  confirmStudentUpload: async (documentId: string): Promise<DocumentDto> => {
    const res = await apiClient.post<ApiResponse<DocumentDto>>('/documents/my/confirm', { documentId });
    return res.data.data!;
  },

  getMyDocumentDownloadUrl: async (documentId: string): Promise<DownloadUrlDto> => {
    const res = await apiClient.get<ApiResponse<DownloadUrlDto>>(`/documents/my/${documentId}/download`);
    return res.data.data!;
  },

  generateMyQuiz: async (documentId: string): Promise<GenerateQuizJobDto> => {
    const res = await apiClient.post<ApiResponse<GenerateQuizJobDto>>(`/documents/my/${documentId}/generate-quiz`);
    return res.data.data!;
  },

  deleteMyDocument: async (documentId: string): Promise<void> => {
    await apiClient.delete(`/documents/my/${documentId}`);
  },

  // ── Upload helper (web) ─────────────────────────────────
  uploadFileToMinio: async (presignedUrl: string, file: File): Promise<void> => {
    const res = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
  },
};
