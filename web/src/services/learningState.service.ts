import { apiClient } from './api';
import type { ApiResponse, BktStateDto, UpdateBktResponse } from '@/types';

export const learningStateService = {
  getStates: async (): Promise<BktStateDto[]> => {
    const res = await apiClient.get<ApiResponse<BktStateDto[]>>('/learning-states/me');
    return res.data.data!;
  },

  getState: async (topicId: string): Promise<BktStateDto> => {
    const res = await apiClient.get<ApiResponse<BktStateDto>>(`/learning-states/me/topic/${topicId}`);
    return res.data.data!;
  },

  updateAfterAnswer: async (topicId: string, isCorrect: boolean, difficulty: number): Promise<UpdateBktResponse> => {
    const res = await apiClient.post<ApiResponse<UpdateBktResponse>>('/learning-states/update', {
      topicId,
      isCorrect,
      difficulty,
    });
    return res.data.data!;
  },

};
