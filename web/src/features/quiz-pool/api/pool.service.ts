import { apiClient } from '@/shared/api/client';
import type { ApiResponse } from '@/shared/api/types';
import type { QuizDto } from '@/features/quizzes/types';
import type { GeneratePoolQuizRequest, TopicPoolDto, PoolQuizDetailDto, CreateTestFromPoolRequest, CreateEntryTestFromPoolRequest, CreateRevisionSetFromPoolRequest } from '@/features/quiz-pool/types';

export const poolService = {
  /**
   * AI tự động sinh câu hỏi và lưu (cộng dồn) vào Pool theo chủ đề
   */
  generatePoolQuiz: async (payload: GeneratePoolQuizRequest): Promise<QuizDto> => {
    const res = await apiClient.post<ApiResponse<QuizDto>>('/pool/generate', payload);
    return res.data.data!;
  },

  /**
   * Lấy danh sách các chủ đề (Topic) có câu hỏi trong Pool
   */
  getTopicsInPool: async (search?: string, classId?: string): Promise<TopicPoolDto[]> => {
    const res = await apiClient.get<ApiResponse<TopicPoolDto[]>>('/pool/topics', {
      params: { search, classId }
    });
    return res.data.data!;
  },

  /**
   * Lấy chi tiết các quiz/câu hỏi thuộc một chủ đề trong Pool để Preview
   */
  getQuizzesInTopicPool: async (topicId: string): Promise<PoolQuizDetailDto[]> => {
    const res = await apiClient.get<ApiResponse<PoolQuizDetailDto[]>>(`/pool/topics/${topicId}/quizzes`);
    return res.data.data!;
  },

  /**
   * Xóa một lượt sinh quiz trong Pool
   */
  deletePoolQuiz: async (quizId: string): Promise<void> => {
    await apiClient.delete(`/pool/quizzes/${quizId}`);
  },

  /**
   * Teacher: Tạo bài test lớp học bằng cách tổng hợp các câu hỏi trong Pool
   */
  createTestFromPool: async (payload: CreateTestFromPoolRequest): Promise<QuizDto> => {
    const res = await apiClient.post<ApiResponse<QuizDto>>('/pool/create-test', payload);
    return res.data.data!;
  },

  createEntryTestFromPool: async (payload: CreateEntryTestFromPoolRequest): Promise<QuizDto> => {
    const res = await apiClient.post<ApiResponse<QuizDto>>('/pool/create-entry-test', payload);
    return res.data.data!;
  },

  /**
   * Student: Tạo bộ ôn tập cá nhân bằng cách tổng hợp các câu hỏi trong Pool
   */
  createRevisionSetFromPool: async (payload: CreateRevisionSetFromPoolRequest): Promise<QuizDto> => {
    const res = await apiClient.post<ApiResponse<QuizDto>>('/pool/create-revision-set', payload);
    return res.data.data!;
  },

  getRevisionSets: async (): Promise<QuizDto[]> => {
    const res = await apiClient.get<ApiResponse<QuizDto[]>>('/pool/revision-sets');
    return res.data.data!;
  },

  /**
   * Đổi tên chủ đề trong Pool (chủ sở hữu hoặc giáo viên sở hữu lớp)
   */
  renamePoolTopic: async (topicId: string, name: string): Promise<TopicPoolDto> => {
    const res = await apiClient.patch<ApiResponse<TopicPoolDto>>(`/pool/topics/${topicId}/rename`, { name });
    return res.data.data!;
  },

  renamePoolQuiz: async (quizId: string, name: string): Promise<PoolQuizDetailDto> => {
    const res = await apiClient.patch<ApiResponse<PoolQuizDetailDto>>(`/pool/quizzes/${quizId}/rename`, { name });
    return res.data.data!;
  },

  updatePoolQuestion: async (questionId: string, data: import('@/features/quizzes/types').UpdateQuestionPayload) => {
    const res = await apiClient.patch<ApiResponse<import('@/features/quizzes/types').QuestionDto>>(`/pool/questions/${questionId}`, data);
    return res.data.data!;
  },
};
