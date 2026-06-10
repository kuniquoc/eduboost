import { apiClient } from './api';
import type { ApiResponse, TopicDto } from '@/types';

export const topicsService = {
  getTopics: async (classId: string): Promise<TopicDto[]> => {
    const res = await apiClient.get<ApiResponse<TopicDto[]>>(`/classes/${classId}/topics`);
    return res.data.data!;
  },

  createTopic: async (classId: string, data: { name: string; description: string }): Promise<TopicDto> => {
    const res = await apiClient.post<ApiResponse<TopicDto>>(`/classes/${classId}/topics`, data);
    return res.data.data!;
  },

  updateTopic: async (classId: string, topicId: string, data: Partial<{ name: string; description: string }>): Promise<TopicDto> => {
    const res = await apiClient.put<ApiResponse<TopicDto>>(`/classes/${classId}/topics/${topicId}`, data);
    return res.data.data!;
  },

  deleteTopic: async (classId: string, topicId: string): Promise<void> => {
    await apiClient.delete(`/classes/${classId}/topics/${topicId}`);
  },

  updateDifficulty: async (classId: string, topicId: string, difficulty: 'easy' | 'medium' | 'hard'): Promise<TopicDto> => {
    const res = await apiClient.put<ApiResponse<TopicDto>>(`/classes/${classId}/topics/${topicId}/difficulty`, { difficulty });
    return res.data.data!;
  },

  updateVisibility: async (classId: string, topicId: string, isDocumentVisible: boolean): Promise<TopicDto> => {
    const res = await apiClient.patch<ApiResponse<TopicDto>>(`/classes/${classId}/topics/${topicId}/visibility`, { isDocumentVisible });
    return res.data.data!;
  },
};
