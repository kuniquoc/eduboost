import { apiClient } from './api';
import type { ApiResponse, LearningPathDto } from '@/types';

export const learningPathService = {
  getPath: async (): Promise<LearningPathDto> => {
    const res = await apiClient.get<ApiResponse<LearningPathDto>>('/learning-paths');
    return res.data.data!;
  },

  regenerate: async (): Promise<LearningPathDto> => {
    const res = await apiClient.post<ApiResponse<LearningPathDto>>('/learning-paths/regenerate');
    return res.data.data!;
  },

  markItemComplete: async (itemId: string): Promise<void> => {
    await apiClient.patch(`/learning-paths/items/${itemId}/complete`);
  },
};
