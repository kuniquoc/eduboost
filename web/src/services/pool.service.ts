import { apiClient } from './api';
import type { 
  ApiResponse, 
  QuizDto, 
  GeneratePoolQuizRequest, 
  TopicPoolDto, 
  PoolQuizDetailDto, 
  CreateTestFromPoolRequest, 
  CreateRevisionSetFromPoolRequest 
} from '@/types';

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
};
