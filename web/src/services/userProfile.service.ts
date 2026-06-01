import { apiClient } from './api';
import type { ApiResponse, UserProfileDto } from '@/types';

export const userProfileService = {
  getProfile: async (): Promise<UserProfileDto> => {
    const res = await apiClient.get<ApiResponse<UserProfileDto>>('/user-profiles/me');
    return res.data.data!;
  },

  updateProfile: async (data: { preferredTopics?: string[] }): Promise<UserProfileDto> => {
    const res = await apiClient.patch<ApiResponse<UserProfileDto>>('/user-profiles/me', data);
    return res.data.data!;
  },
};
