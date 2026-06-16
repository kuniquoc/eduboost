import { apiClient } from './api';
import type { ApiResponse, ClassDto, ClassDetailDto, StudentEnrollmentDto, ClassmateDto } from '@/types';

export const classesService = {
  // ── Teacher ─────────────────────────────────────────────
  getTeacherClasses: async (): Promise<ClassDto[]> => {
    const res = await apiClient.get<ApiResponse<ClassDto[]>>('/classes');
    return res.data.data!;
  },

  createClass: async (data: { name: string; description: string; coverColor: string }): Promise<ClassDto> => {
    const res = await apiClient.post<ApiResponse<ClassDto>>('/classes', data);
    return res.data.data!;
  },

  getClass: async (id: string): Promise<ClassDetailDto> => {
    const res = await apiClient.get<ApiResponse<ClassDetailDto>>(`/classes/${id}`);
    return res.data.data!;
  },

  updateClass: async (id: string, data: Partial<{ name: string; description: string; coverColor: string }>): Promise<ClassDto> => {
    const res = await apiClient.put<ApiResponse<ClassDto>>(`/classes/${id}`, data);
    return res.data.data!;
  },

  deleteClass: async (id: string): Promise<void> => {
    await apiClient.delete(`/classes/${id}`);
  },

  setActiveEntryTest: async (classId: string, quizId: string): Promise<void> => {
    await apiClient.put(`/classes/${classId}/active-entry-test`, { quizId });
  },

  getStudents: async (classId: string, search?: string): Promise<StudentEnrollmentDto[]> => {
    const res = await apiClient.get<ApiResponse<StudentEnrollmentDto[]>>(`/classes/${classId}/students`, { params: { search } });
    return res.data.data!;
  },

  addStudent: async (classId: string, studentEmail: string): Promise<void> => {
    await apiClient.post(`/classes/${classId}/students`, { studentEmail });
  },

  removeStudent: async (classId: string, studentId: string): Promise<void> => {
    await apiClient.delete(`/classes/${classId}/students/${studentId}`);
  },

  // ── Student ─────────────────────────────────────────────
  getEnrolledClasses: async (): Promise<ClassDto[]> => {
    const res = await apiClient.get<ApiResponse<ClassDto[]>>('/classes/enrolled');
    return res.data.data!;
  },

  joinClass: async (classCode: string): Promise<ClassDto> => {
    const res = await apiClient.post<ApiResponse<ClassDto>>('/classes/join', { classCode });
    return res.data.data!;
  },

  getClassmates: async (classId: string): Promise<ClassmateDto[]> => {
    const res = await apiClient.get<ApiResponse<ClassmateDto[]>>(`/classes/${classId}/classmates`);
    return res.data.data!;
  },
};
