import { apiClient } from './api';
import type {
  ApiResponse,
  StartPracticeResponse,
  SubmitPracticeAnswerResponse,
  PracticeSessionSummary,
} from '@/types';

export const practiceSessionService = {
  start: async (topicId: string, questionCount?: number): Promise<StartPracticeResponse> => {
    const res = await apiClient.post<ApiResponse<StartPracticeResponse>>('/practice-sessions/start', {
      topicId,
      questionCount,
    });
    return res.data.data!;
  },

  submitAnswer: async (
    sessionId: string,
    questionId: string,
    selectedOptionIds: string[],
  ): Promise<SubmitPracticeAnswerResponse> => {
    const res = await apiClient.post<ApiResponse<SubmitPracticeAnswerResponse>>('/practice-sessions/answer', {
      sessionId,
      questionId,
      selectedOptionIds,
    });
    return res.data.data!;
  },

  getSummary: async (sessionId: string): Promise<PracticeSessionSummary> => {
    const res = await apiClient.get<ApiResponse<PracticeSessionSummary>>(`/practice-sessions/${sessionId}/summary`);
    return res.data.data!;
  },
};
