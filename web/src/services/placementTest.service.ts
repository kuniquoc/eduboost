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
    const res = await apiClient.post<ApiResponse<StartPlacementTestResponse>>('/placement-tests/start', { classId });
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
      selectedOptionIds,
    });
    return res.data.data!;
  },

  complete: async (sessionId: string): Promise<CompletePlacementResponse> => {
    const res = await apiClient.post<ApiResponse<CompletePlacementResponse>>('/placement-tests/complete', { sessionId });
    return res.data.data!;
  },

  getResults: async (): Promise<PlacementTestResultDto[]> => {
    const res = await apiClient.get<ApiResponse<PlacementTestResultDto[]>>('/placement-tests/results');
    return res.data.data!;
  },
};
