import { apiClient } from './api';
import type { ApiResponse, RoadmapDto, RoadmapStepDto } from '@/types';

export const roadmapService = {
  getRoadmap: async (classId: string): Promise<RoadmapDto> => {
    const res = await apiClient.get<ApiResponse<RoadmapDto>>(`/roadmap/${classId}`);
    return res.data.data!;
  },

  generateRoadmap: async (classId: string, entryTestResultId: string): Promise<RoadmapDto> => {
    const res = await apiClient.post<ApiResponse<RoadmapDto>>(`/roadmap/${classId}/generate`, { entryTestResultId });
    return res.data.data!;
  },

  updateStep: async (classId: string, stepId: string, progress: number, status: string): Promise<RoadmapStepDto> => {
    const res = await apiClient.patch<ApiResponse<RoadmapStepDto>>(`/roadmap/${classId}/steps/${stepId}`, { progress, status });
    return res.data.data!;
  },
};
