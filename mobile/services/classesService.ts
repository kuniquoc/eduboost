import { apiClient } from './api';
import type { ApiResponse, ClassDto, ClassDetailDto, StudentEnrollmentDto } from '../types';

export const classesService = {
  // ── Teacher ──────────────────────────────────────────────────────────────────

  /** Teacher: Lấy danh sách lớp của mình */
  getTeacherClasses: async (): Promise<ClassDto[]> => {
    const res = await apiClient.get<ApiResponse<ClassDto[]>>('/classes');
    return res.data.data!;
  },

  /** Teacher: Tạo lớp học mới */
  createClass: async (data: {
    name: string;
    description: string;
    coverColor: string;
  }): Promise<ClassDto> => {
    const res = await apiClient.post<ApiResponse<ClassDto>>('/classes', data);
    return res.data.data!;
  },

  /** Lấy chi tiết lớp học (kèm danh sách topic) */
  getClass: async (id: string): Promise<ClassDetailDto> => {
    const res = await apiClient.get<ApiResponse<ClassDetailDto>>(`/classes/${id}`);
    return res.data.data!;
  },

  /** Teacher: Cập nhật lớp học */
  updateClass: async (
    id: string,
    data: Partial<{ name: string; description: string; coverColor: string }>
  ): Promise<ClassDto> => {
    const res = await apiClient.put<ApiResponse<ClassDto>>(`/classes/${id}`, data);
    return res.data.data!;
  },

  /** Teacher: Xoá lớp học */
  deleteClass: async (id: string): Promise<void> => {
    await apiClient.delete(`/classes/${id}`);
  },

  /** Teacher: Lấy danh sách học sinh trong lớp */
  getStudents: async (classId: string, search?: string): Promise<StudentEnrollmentDto[]> => {
    const res = await apiClient.get<ApiResponse<StudentEnrollmentDto[]>>(
      `/classes/${classId}/students`,
      { params: { search } }
    );
    return res.data.data!;
  },

  /** Teacher: Thêm học sinh vào lớp bằng email */
  addStudent: async (classId: string, studentEmail: string): Promise<void> => {
    await apiClient.post(`/classes/${classId}/students`, { studentEmail });
  },

  /** Teacher: Xoá học sinh khỏi lớp */
  removeStudent: async (classId: string, studentId: string): Promise<void> => {
    await apiClient.delete(`/classes/${classId}/students/${studentId}`);
  },

  // ── Student ──────────────────────────────────────────────────────────────────

  /** Student: Lấy danh sách lớp đang tham gia */
  getEnrolledClasses: async (): Promise<ClassDto[]> => {
    const res = await apiClient.get<ApiResponse<ClassDto[]>>('/classes/enrolled');
    return res.data.data!;
  },

  /** Student: Tham gia lớp học bằng mã code */
  joinClass: async (classCode: string): Promise<ClassDto> => {
    const res = await apiClient.post<ApiResponse<ClassDto>>('/classes/join', { classCode });
    return res.data.data!;
  },
};
