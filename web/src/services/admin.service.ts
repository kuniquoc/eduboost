import { apiClient } from './api';
import type { ApiResponse, AdminUserDto, SystemStatsDto } from '@/types';

export const adminService = {
  getUsers: async (page = 1, pageSize = 20): Promise<{ users: AdminUserDto[]; total: number }> => {
    const res = await apiClient.get<ApiResponse<{ users: AdminUserDto[]; total: number }>>('/admin/users', {
      params: { page, pageSize },
    });
    return res.data.data!;
  },

  updateRole: async (userId: string, role: string): Promise<void> => {
    await apiClient.patch(`/admin/users/${userId}/role`, { role });
  },

  getStats: async (): Promise<SystemStatsDto> => {
    const res = await apiClient.get<ApiResponse<SystemStatsDto>>('/admin/stats');
    return res.data.data!;
  },
};
