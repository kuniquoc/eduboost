import { apiClient } from '@/shared/api/client';
import type { ApiResponse } from '@/shared/api/types';
import type { QuestionDto, QuizResultDto, EntryTestDto, SubmitQuizRequest, UpdateQuestionPayload, CreateQuizRequest, CreateQuestionPayload, QuizDto } from '@/features/quizzes/types';
import type { TutorNextActionDto, TutorQuestionDto, TutorAnswerRequest, TutorAnswerResult, ExplainErrorRequest } from '@/shared/types/learning';

export const quizzesService = {
  // ── Teacher ─────────────────────────────────────────────
  getQuiz: async (quizId: string): Promise<QuizDto> => {
    const res = await apiClient.get<ApiResponse<QuizDto>>(`/quizzes/${quizId}`);
    return res.data.data!;
  },

  getQuestions: async (quizId: string): Promise<QuestionDto[]> => {
    const res = await apiClient.get<ApiResponse<QuestionDto[]>>(`/quizzes/${quizId}/questions`);
    return res.data.data!;
  },

  updateQuestion: async (quizId: string, qId: string, data: UpdateQuestionPayload): Promise<QuestionDto> => {
    const res = await apiClient.put<ApiResponse<QuestionDto>>(`/quizzes/${quizId}/questions/${qId}`, data);
    return res.data.data!;
  },

  deleteQuestion: async (quizId: string, qId: string): Promise<void> => {
    await apiClient.delete(`/quizzes/${quizId}/questions/${qId}`);
  },

  deleteMyQuestion: async (quizId: string, qId: string): Promise<void> => {
    await apiClient.delete(`/quizzes/my/${quizId}/questions/${qId}`);
  },

  addQuestion: async (quizId: string, data: CreateQuestionPayload): Promise<QuestionDto> => {
    const res = await apiClient.post<ApiResponse<QuestionDto>>(`/quizzes/${quizId}/questions`, data);
    return res.data.data!;
  },

  addQuestionsFromPool: async (quizId: string, questionIds: string[]): Promise<QuestionDto[]> => {
    const res = await apiClient.post<ApiResponse<QuestionDto[]>>(`/quizzes/${quizId}/questions/from-pool`, { questionIds });
    return res.data.data!;
  },

  deleteQuiz: async (quizId: string): Promise<void> => {
    await apiClient.delete(`/quizzes/${quizId}`);
  },

  verifyQuestion: async (quizId: string, qId: string, verified: boolean): Promise<QuestionDto> => {
    const res = await apiClient.patch<ApiResponse<QuestionDto>>(`/quizzes/${quizId}/questions/${qId}/verify`, { verified });
    return res.data.data!;
  },

  publishQuiz: async (quizId: string): Promise<void> => {
    await apiClient.post(`/quizzes/${quizId}/publish`);
  },

  getClassQuizzes: async (classId: string): Promise<QuizDto[]> => {
    const res = await apiClient.get<ApiResponse<QuizDto[]>>(`/quizzes/class/${classId}`);
    return res.data.data!;
  },

  // ── Student ─────────────────────────────────────────────
  getEntryTest: async (classId: string): Promise<EntryTestDto> => {
    const res = await apiClient.get<ApiResponse<EntryTestDto>>(`/quizzes/entry-test/${classId}`);
    return res.data.data!;
  },

  submitEntryTest: async (classId: string, request: SubmitQuizRequest): Promise<QuizResultDto> => {
    const res = await apiClient.post<ApiResponse<QuizResultDto>>(`/quizzes/entry-test/${classId}/submit`, request);
    return res.data.data!;
  },

  getPracticeQuiz: async (topicId: string, limit = 10): Promise<EntryTestDto> => {
    const res = await apiClient.get<ApiResponse<EntryTestDto>>(`/quizzes/practice/${topicId}`, { params: { limit } });
    return res.data.data!;
  },

  submitPracticeQuiz: async (topicId: string, request: SubmitQuizRequest): Promise<QuizResultDto> => {
    const res = await apiClient.post<ApiResponse<QuizResultDto>>(`/quizzes/practice/${topicId}/submit`, request);
    return res.data.data!;
  },

  getMyQuizQuestions: async (quizId: string): Promise<QuestionDto[]> => {
    const res = await apiClient.get<ApiResponse<QuestionDto[]>>(`/quizzes/my/${quizId}/questions`);
    return res.data.data!;
  },

  updateMyQuestion: async (quizId: string, qId: string, data: UpdateQuestionPayload): Promise<QuestionDto> => {
    const res = await apiClient.put<ApiResponse<QuestionDto>>(`/quizzes/my/${quizId}/questions/${qId}`, data);
    return res.data.data!;
  },

  // ── Manual Quiz Creation ──────────────────────────────────
  createQuiz: async (data: CreateQuizRequest): Promise<QuizDto> => {
    const res = await apiClient.post<ApiResponse<QuizDto>>('/quizzes/create', data);
    return res.data.data!;
  },

  createMyQuiz: async (data: CreateQuizRequest): Promise<QuizDto> => {
    const res = await apiClient.post<ApiResponse<QuizDto>>('/quizzes/my/create', data);
    return res.data.data!;
  },

  // ── AI Tutor (Adaptive Learning) ────────────────────────────
  getTutorNextAction: async (topicId: string): Promise<TutorNextActionDto> => {
    const res = await apiClient.get<ApiResponse<TutorNextActionDto>>(`/quizzes/tutor/next-action`, { params: { topicId } });
    return res.data.data!;
  },

  generateAdaptiveQuestion: async (topicId: string): Promise<TutorQuestionDto> => {
    const res = await apiClient.get<ApiResponse<TutorQuestionDto>>(`/quizzes/tutor/generate-question`, { params: { topicId } });
    return res.data.data!;
  },

  submitTutorAnswer: async (request: TutorAnswerRequest): Promise<TutorAnswerResult> => {
    const res = await apiClient.post<ApiResponse<TutorAnswerResult>>(`/quizzes/tutor/submit-answer`, request);
    return res.data.data!;
  },

  completeTutorPractice: async (
    topicId: string,
    questionsAttempted: number,
    correctAnswers: number,
  ): Promise<void> => {
    await apiClient.post('/quizzes/tutor/complete-practice', {
      topicId,
      questionsAttempted,
      correctAnswers,
    });
  },

  getTutorExplanation: async (topicId: string): Promise<{ content: string; offline: boolean }> => {
    const res = await apiClient.get<ApiResponse<{ explanation: string; offline: boolean }>>(`/quizzes/tutor/explain`, { params: { topicId } });
    return { content: res.data.data!.explanation, offline: res.data.data!.offline };
  },

  getErrorExplanation: async (request: ExplainErrorRequest): Promise<{ explanation: string; offline: boolean }> => {
    const res = await apiClient.post<ApiResponse<{ explanation: string; offline: boolean }>>(`/quizzes/tutor/explain-error`, request);
    return { explanation: res.data.data!.explanation, offline: res.data.data!.offline };
  },
};
