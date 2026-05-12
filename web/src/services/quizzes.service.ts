import { apiClient } from './api';
import type { ApiResponse, QuestionDto, QuizResultDto, EntryTestDto, SubmitQuizRequest, UpdateQuestionPayload, CreateQuizRequest, CreateQuestionPayload, QuizDto } from '@/types';

export const quizzesService = {
  // ── Teacher ─────────────────────────────────────────────
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

  addQuestion: async (quizId: string, data: CreateQuestionPayload): Promise<QuestionDto> => {
    const res = await apiClient.post<ApiResponse<QuestionDto>>(`/quizzes/${quizId}/questions`, data);
    return res.data.data!;
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

  generateEntryTest: async (classId: string): Promise<QuizDto> => {
    const res = await apiClient.post<ApiResponse<QuizDto>>(`/quizzes/generate-entry-test/${classId}`);
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
};
