import { apiClient } from './api';
import type {
  ApiResponse,
  StudentAnalyticsDto,
  ClassAnalyticsDto,
  StudentProgressDto,
  StudentStatsDto,
} from '../types';

export const studentsService = {
  // ── Teacher ──────────────────────────────────────────────────────────────────

  /** Teacher: Thống kê tổng quan toàn lớp */
  getClassAnalytics: async (classId: string): Promise<ClassAnalyticsDto> => {
    const res = await apiClient.get<ApiResponse<ClassAnalyticsDto>>(
      `/classes/${classId}/analytics`
    );
    return res.data.data!;
  },

  /** Teacher: Chi tiết analytics của một học sinh trong lớp */
  getStudentAnalytics: async (
    classId: string,
    studentId: string
  ): Promise<StudentAnalyticsDto> => {
    const res = await apiClient.get<ApiResponse<StudentAnalyticsDto>>(
      `/classes/${classId}/students/${studentId}/analytics`
    );
    return res.data.data!;
  },

  // ── Student ──────────────────────────────────────────────────────────────────

  /** Student: Tiến độ học tập của bản thân */
  getMyProgress: async (): Promise<StudentProgressDto> => {
    const res = await apiClient.get<ApiResponse<StudentProgressDto>>(
      '/students/me/progress'
    );
    return res.data.data!;
  },

  /** Student: Thống kê cá nhân (streak, avg score...) */
  getMyStats: async (): Promise<StudentStatsDto> => {
    const res = await apiClient.get<ApiResponse<StudentStatsDto>>(
      '/students/me/stats'
    );
    return res.data.data!;
  },
};
