import { apiClient } from './api';
import type { ApiResponse, QuestionDto, QuizResultDto } from '../types';

export interface EntryTestDto {
  quizId: string;
  classId: string;
  className: string;
  questions: QuestionDto[];
}

export interface SubmitQuizRequest {
  answers: Array<{
    questionId: string;
    selectedOptionIds: string[];
    fillBlankValue?: string;
    timeSpentSeconds: number;
  }>;
}

export interface UpdateQuestionPayload {
  text?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  explanation?: string;
  options?: Array<{ id?: string; text: string; isCorrect: boolean }>;
}

export const quizzesService = {
  // ── Teacher ──────────────────────────────────────────────────────────────────

  /** Teacher: Lấy câu hỏi của quiz để kiểm duyệt */
  getQuestions: async (quizId: string): Promise<QuestionDto[]> => {
    const res = await apiClient.get<ApiResponse<QuestionDto[]>>(
      `/quizzes/${quizId}/questions`
    );
    return res.data.data!;
  },

  /** Teacher: Chỉnh sửa câu hỏi */
  updateQuestion: async (
    quizId: string,
    qId: string,
    data: UpdateQuestionPayload
  ): Promise<QuestionDto> => {
    const res = await apiClient.put<ApiResponse<QuestionDto>>(
      `/quizzes/${quizId}/questions/${qId}`,
      data
    );
    return res.data.data!;
  },

  /** Teacher: Xoá câu hỏi */
  deleteQuestion: async (quizId: string, qId: string): Promise<void> => {
    await apiClient.delete(`/quizzes/${quizId}/questions/${qId}`);
  },

  /** Teacher: Đánh dấu câu hỏi đã/chưa được kiểm duyệt */
  verifyQuestion: async (
    quizId: string,
    qId: string,
    verified: boolean
  ): Promise<QuestionDto> => {
    const res = await apiClient.patch<ApiResponse<QuestionDto>>(
      `/quizzes/${quizId}/questions/${qId}/verify`,
      { verified }
    );
    return res.data.data!;
  },

  /** Teacher: Publish quiz lên lớp học */
  publishQuiz: async (quizId: string): Promise<void> => {
    await apiClient.post(`/quizzes/${quizId}/publish`);
  },

  // ── Student ──────────────────────────────────────────────────────────────────

  /** Student: Lấy bài test đầu vào của lớp */
  getEntryTest: async (classId: string): Promise<EntryTestDto> => {
    const res = await apiClient.get<ApiResponse<EntryTestDto>>(
      `/quizzes/entry-test/${classId}`
    );
    return res.data.data!;
  },

  /** Student: Nộp bài test đầu vào */
  submitEntryTest: async (
    classId: string,
    request: SubmitQuizRequest
  ): Promise<QuizResultDto> => {
    const res = await apiClient.post<ApiResponse<QuizResultDto>>(
      `/quizzes/entry-test/${classId}/submit`,
      request
    );
    return res.data.data!;
  },

  /** Student: Lấy câu hỏi luyện tập theo topic */
  getPracticeQuiz: async (topicId: string, limit = 10): Promise<EntryTestDto> => {
    const res = await apiClient.get<ApiResponse<EntryTestDto>>(
      `/quizzes/practice/${topicId}`,
      { params: { limit } }
    );
    return res.data.data!;
  },

  /** Student: Nộp bài luyện tập */
  submitPracticeQuiz: async (
    topicId: string,
    request: SubmitQuizRequest
  ): Promise<QuizResultDto> => {
    const res = await apiClient.post<ApiResponse<QuizResultDto>>(
      `/quizzes/practice/${topicId}/submit`,
      request
    );
    return res.data.data!;
  },

  /** Student: Lấy câu hỏi quiz riêng (từ tài liệu cá nhân) */
  getMyQuizQuestions: async (quizId: string): Promise<QuestionDto[]> => {
    const res = await apiClient.get<ApiResponse<QuestionDto[]>>(
      `/quizzes/my/${quizId}/questions`
    );
    return res.data.data!;
  },

  /** Student: Chỉnh sửa câu hỏi trong quiz riêng */
  updateMyQuestion: async (
    quizId: string,
    qId: string,
    data: UpdateQuestionPayload
  ): Promise<QuestionDto> => {
    const res = await apiClient.put<ApiResponse<QuestionDto>>(
      `/quizzes/my/${quizId}/questions/${qId}`,
      data
    );
    return res.data.data!;
  },
};
