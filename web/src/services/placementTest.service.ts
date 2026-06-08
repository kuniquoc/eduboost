import { apiClient } from './api';
import type {
  ApiResponse,
  StartPlacementTestResponse,
  AnswerPlacementResponse,
  CompletePlacementResponse,
  PlacementTestResultDto,
} from '@/types';

export const placementTestService = {
  start: async (classId: string): Promise<StartPlacementTestResponse> => {
    const res = await apiClient.post<ApiResponse<StartPlacementTestResponse>>('/placement-tests/start', {
      classId: classId || undefined,
    });
    return res.data.data!;
  },

  submitAnswer: async (
    sessionId: string,
    questionId: string,
    selectedOptionIds: string[],
  ): Promise<AnswerPlacementResponse> => {
    const res = await apiClient.post<ApiResponse<AnswerPlacementResponse>>('/placement-tests/answer', {
      sessionId,
      questionId,
      selectedOptionId: selectedOptionIds[0],
      selectedOptionIds,
    });
    return res.data.data!;
  },

  complete: async (sessionId: string): Promise<CompletePlacementResponse> => {
    const res = await apiClient.post<ApiResponse<CompletePlacementResponse>>('/placement-tests/complete', {
      sessionId,
    });
    return res.data.data!;
  },

  getResult: async (classId?: string): Promise<PlacementTestResultDto> => {
    const res = await apiClient.get<ApiResponse<PlacementTestResultDto>>('/placement-tests/result', {
      params: classId ? { classId } : undefined,
    });
    return res.data.data!;
  },
};
