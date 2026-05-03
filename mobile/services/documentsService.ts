import { apiClient } from './api';
import type {
  ApiResponse,
  DocumentDto,
  UploadUrlDto,
  DownloadUrlDto,
  GenerateQuizJobDto,
} from '../types';

interface RequestUploadUrlPayload {
  fileName: string;
  contentType: string;
  topicId?: string;
}

interface ConfirmUploadPayload {
  documentId: string;
}

interface GenerateQuizFromDocPayload {
  topicId: string;
}

export const documentsService = {
  // ── Teacher — Tài liệu lớp học ──────────────────────────────────────────────

  /** Lấy danh sách tài liệu của lớp */
  getClassDocuments: async (classId: string): Promise<DocumentDto[]> => {
    const res = await apiClient.get<ApiResponse<DocumentDto[]>>(
      `/classes/${classId}/documents`
    );
    return res.data.data!;
  },

  /**
   * Bước 1: Yêu cầu presigned upload URL từ MinIO.
   * Client dùng URL này để PUT file trực tiếp lên MinIO.
   */
  requestClassUploadUrl: async (
    classId: string,
    payload: RequestUploadUrlPayload
  ): Promise<UploadUrlDto> => {
    const res = await apiClient.post<ApiResponse<UploadUrlDto>>(
      `/classes/${classId}/documents/request-upload`,
      payload
    );
    return res.data.data!;
  },

  /**
   * Bước 2: Xác nhận đã upload xong → document chuyển sang trạng thái ready.
   */
  confirmClassUpload: async (
    classId: string,
    payload: ConfirmUploadPayload
  ): Promise<DocumentDto> => {
    const res = await apiClient.post<ApiResponse<DocumentDto>>(
      `/classes/${classId}/documents/confirm`,
      payload
    );
    return res.data.data!;
  },

  /** Lấy presigned URL để tải tài liệu của lớp */
  getClassDocumentDownloadUrl: async (
    classId: string,
    documentId: string
  ): Promise<DownloadUrlDto> => {
    const res = await apiClient.get<ApiResponse<DownloadUrlDto>>(
      `/classes/${classId}/documents/${documentId}/download`
    );
    return res.data.data!;
  },

  /** Xoá tài liệu khỏi lớp (xoá cả file trong MinIO) */
  deleteClassDocument: async (classId: string, documentId: string): Promise<void> => {
    await apiClient.delete(`/classes/${classId}/documents/${documentId}`);
  },

  /** Teacher: Yêu cầu AI tạo quiz từ tài liệu */
  generateQuizFromDocument: async (
    classId: string,
    documentId: string,
    payload: GenerateQuizFromDocPayload
  ): Promise<GenerateQuizJobDto> => {
    const res = await apiClient.post<ApiResponse<GenerateQuizJobDto>>(
      `/classes/${classId}/documents/${documentId}/generate-quiz`,
      payload
    );
    return res.data.data!;
  },

  // ── Student — Tài liệu riêng ─────────────────────────────────────────────────

  /** Lấy danh sách tài liệu riêng của student */
  getMyDocuments: async (): Promise<DocumentDto[]> => {
    const res = await apiClient.get<ApiResponse<DocumentDto[]>>('/documents/my');
    return res.data.data!;
  },

  /**
   * Bước 1: Yêu cầu presigned URL upload tài liệu riêng
   */
  requestStudentUploadUrl: async (
    payload: RequestUploadUrlPayload
  ): Promise<UploadUrlDto> => {
    const res = await apiClient.post<ApiResponse<UploadUrlDto>>(
      '/documents/my/request-upload',
      payload
    );
    return res.data.data!;
  },

  /**
   * Bước 2: Xác nhận upload tài liệu riêng
   */
  confirmStudentUpload: async (
    payload: ConfirmUploadPayload
  ): Promise<DocumentDto> => {
    const res = await apiClient.post<ApiResponse<DocumentDto>>(
      '/documents/my/confirm',
      payload
    );
    return res.data.data!;
  },

  /** Lấy presigned URL tải tài liệu riêng */
  getMyDocumentDownloadUrl: async (documentId: string): Promise<DownloadUrlDto> => {
    const res = await apiClient.get<ApiResponse<DownloadUrlDto>>(
      `/documents/my/${documentId}/download`
    );
    return res.data.data!;
  },

  /** Student: AI tạo quiz từ tài liệu riêng */
  generateMyQuiz: async (documentId: string): Promise<GenerateQuizJobDto> => {
    const res = await apiClient.post<ApiResponse<GenerateQuizJobDto>>(
      `/documents/my/${documentId}/generate-quiz`
    );
    return res.data.data!;
  },

  /** Xoá tài liệu riêng */
  deleteMyDocument: async (documentId: string): Promise<void> => {
    await apiClient.delete(`/documents/my/${documentId}`);
  },

  // ── Upload helper ─────────────────────────────────────────────────────────────

  /**
   * Upload file trực tiếp lên MinIO bằng presigned URL.
   * Sử dụng fetch thuần vì axios không hỗ trợ tốt binary PUT.
   *
   * @param presignedUrl URL từ requestClassUploadUrl / requestStudentUploadUrl
   * @param fileUri URI của file từ expo-document-picker / expo-image-picker
   * @param contentType MIME type (vd: 'application/pdf', 'image/png')
   */
  uploadFileToMinio: async (
    presignedUrl: string,
    fileUri: string,
    contentType: string
  ): Promise<void> => {
    const response = await fetch(fileUri);
    const blob = await response.blob();

    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload thất bại: HTTP ${uploadResponse.status}`);
    }
  },
};
