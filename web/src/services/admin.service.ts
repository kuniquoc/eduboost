import { apiClient } from './api';
import type { ApiResponse, AdminUserDto, SystemStatsDto } from '@/types';

export const adminService = {
  getUsers: async (search?: string, role?: string): Promise<AdminUserDto[]> => {
    const res = await apiClient.get<ApiResponse<AdminUserDto[]>>('/admin/users', {
      params: { search, role },
    });
    return res.data.data!;
  },

  updateRole: async (userId: string, role: string): Promise<void> => {
    await apiClient.put(`/admin/users/${userId}/role`, { role });
  },

  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`/admin/users/${userId}`);
  },

  getStats: async (): Promise<SystemStatsDto> => {
    const res = await apiClient.get<ApiResponse<SystemStatsDto>>('/admin/stats');
    return res.data.data!;
  },
};
