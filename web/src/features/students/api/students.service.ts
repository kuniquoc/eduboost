import { apiClient } from '@/shared/api/client';
import type { ApiResponse } from '@/shared/api/types';
import type { StudentAnalyticsDto, ClassAnalyticsDto, StudentProgressDto, StudentStatsDto } from '@/features/students/types';

export const studentsService = {
  // ── Teacher ─────────────────────────────────────────────
  getClassAnalytics: async (classId: string): Promise<ClassAnalyticsDto> => {
    const res = await apiClient.get<ApiResponse<ClassAnalyticsDto>>(`/classes/${classId}/analytics`);
    return res.data.data!;
  },

  getStudentAnalytics: async (classId: string, studentId: string): Promise<StudentAnalyticsDto> => {
    const res = await apiClient.get<ApiResponse<StudentAnalyticsDto>>(`/classes/${classId}/students/${studentId}/analytics`);
    return res.data.data!;
  },

  // ── Student ─────────────────────────────────────────────
  getMyProgress: async (): Promise<StudentProgressDto> => {
    const res = await apiClient.get<ApiResponse<StudentProgressDto>>('/students/me/progress');
    return res.data.data!;
  },

  getMyStats: async (): Promise<StudentStatsDto> => {
    const res = await apiClient.get<ApiResponse<StudentStatsDto>>('/students/me/stats');
    return res.data.data!;
  },
};
