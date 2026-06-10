import { apiClient } from './api';
import type { ApiResponse, TopicDto } from '../types';

export const topicsService = {
  /** Teacher + Student: Lấy danh sách topic của lớp */
  getTopics: async (classId: string): Promise<TopicDto[]> => {
    const res = await apiClient.get<ApiResponse<TopicDto[]>>(`/classes/${classId}/topics`);
    return res.data.data!;
  },

  /** Teacher: Tạo topic mới */
  createTopic: async (
    classId: string,
    data: { name: string; description: string }
  ): Promise<TopicDto> => {
    const res = await apiClient.post<ApiResponse<TopicDto>>(
      `/classes/${classId}/topics`,
      data
    );
    return res.data.data!;
  },

  /** Teacher: Cập nhật tên/mô tả topic */
  updateTopic: async (
    classId: string,
    topicId: string,
    data: Partial<{ name: string; description: string }>
  ): Promise<TopicDto> => {
    const res = await apiClient.put<ApiResponse<TopicDto>>(
      `/classes/${classId}/topics/${topicId}`,
      data
    );
    return res.data.data!;
  },

  /** Teacher: Xoá topic */
  deleteTopic: async (classId: string, topicId: string): Promise<void> => {
    await apiClient.delete(`/classes/${classId}/topics/${topicId}`);
  },

  /** Teacher: Chỉnh sửa độ khó thủ công */
  updateDifficulty: async (
    classId: string,
    topicId: string,
    difficulty: 'easy' | 'medium' | 'hard'
  ): Promise<TopicDto> => {
    const res = await apiClient.put<ApiResponse<TopicDto>>(
      `/classes/${classId}/topics/${topicId}/difficulty`,
      { difficulty }
    );
    return res.data.data!;
  },

  /** Teacher: Bật/tắt quyền xem document của topic cho học sinh */
  updateVisibility: async (
    classId: string,
    topicId: string,
    isDocumentVisible: boolean
  ): Promise<TopicDto> => {
    const res = await apiClient.patch<ApiResponse<TopicDto>>(
      `/classes/${classId}/topics/${topicId}/visibility`,
      { isDocumentVisible }
    );
    return res.data.data!;
  },
};
