import { apiClient } from './api';
import type { ApiResponse, RoadmapDto, RoadmapStepDto } from '../types';

export const roadmapService = {
  /** Student: Lấy lộ trình học tập trong lớp */
  getRoadmap: async (classId: string): Promise<RoadmapDto> => {
    const res = await apiClient.get<ApiResponse<RoadmapDto>>(`/roadmap/${classId}`);
    return res.data.data!;
  },

  /**
   * Student: AI tạo lộ trình cá nhân hoá sau khi nộp bài test đầu vào.
   * @param entryTestResultId quizResultId trả về từ submitEntryTest()
   */
  generateRoadmap: async (
    classId: string,
    entryTestResultId: string
  ): Promise<RoadmapDto> => {
    const res = await apiClient.post<ApiResponse<RoadmapDto>>(
      `/roadmap/${classId}/generate`,
      { entryTestResultId }
    );
    return res.data.data!;
  },

  /** Student: Cập nhật tiến độ một bước trong lộ trình */
  updateStep: async (
    classId: string,
    stepId: string,
    progress: number,
    status: 'completed' | 'in_progress' | 'recommended' | 'locked'
  ): Promise<RoadmapStepDto> => {
    const res = await apiClient.patch<ApiResponse<RoadmapStepDto>>(
      `/roadmap/${classId}/steps/${stepId}`,
      { progress, status }
    );
    return res.data.data!;
  },
};
