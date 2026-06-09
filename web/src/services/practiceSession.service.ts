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
      mode: 'standard',
    });
    return res.data.data!;
  },

  startReview: async (questionIds?: string[]): Promise<StartPracticeResponse> => {
    const res = await apiClient.post<ApiResponse<StartPracticeResponse>>('/practice-sessions/start-review', {
      questionIds: questionIds?.length ? questionIds : undefined,
    });
    return res.data.data!;
  },

  startFixed: async (questionIds: string[], topicId?: string): Promise<StartPracticeResponse> => {
    const res = await apiClient.post<ApiResponse<StartPracticeResponse>>('/practice-sessions/start', {
      mode: 'fixed',
      questionIds,
      ...(topicId ? { topicId } : {}),
    });
    return res.data.data!;
  },

  submitAnswer: async (
    sessionId: string,
    questionId: string,
    selectedOptionIds: string[],
    responseTimeSeconds?: number,
  ): Promise<SubmitPracticeAnswerResponse> => {
    const res = await apiClient.post<ApiResponse<SubmitPracticeAnswerResponse>>('/practice-sessions/answer', {
      sessionId,
      questionId,
      selectedOptionId: selectedOptionIds[0],
      selectedOptionIds,
      responseTimeSeconds,
    });
    return res.data.data!;
  },

  endSession: async (sessionId: string): Promise<PracticeSessionSummary> => {
    const res = await apiClient.post<ApiResponse<PracticeSessionSummary>>('/practice-sessions/end', {
      sessionId,
    });
    return res.data.data!;
  },
};
