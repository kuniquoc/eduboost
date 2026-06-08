import { apiClient, tokenManager } from './api';
import type { ApiResponse, AuthTokens, User } from '@/types';

export const authService = {
  login: async (email: string, password: string): Promise<AuthTokens> => {
    const res = await apiClient.post<ApiResponse<AuthTokens>>('/auth/login', { email, password });
    const data = res.data.data!;
    tokenManager.saveTokens(data.accessToken, data.refreshToken);
    return data;
  },

  register: async (name: string, email: string, password: string, role: string): Promise<AuthTokens> => {
    const res = await apiClient.post<ApiResponse<AuthTokens>>('/auth/register', { name, email, password, role });
    const data = res.data.data!;
    tokenManager.saveTokens(data.accessToken, data.refreshToken);
    return data;
  },

  getMe: async (): Promise<User> => {
    const res = await apiClient.get<ApiResponse<User>>('/auth/me');
    return res.data.data!;
  },

  updateName: async (name: string): Promise<User> => {
    const res = await apiClient.patch<ApiResponse<User>>('/auth/me/name', { name });
    return res.data.data!;
  },

  uploadAvatar: async (file: File): Promise<User> => {
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.post<ApiResponse<User>>('/auth/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data!;
  },

  logout: async (): Promise<void> => {
    try {
      const refreshToken = tokenManager.getRefreshToken();
      if (refreshToken) {
        await apiClient.post('/auth/revoke', { refreshToken });
      }
    } catch {
      // Ignore revoke errors
    } finally {
      tokenManager.clearTokens();
    }
  },

  refreshToken: async (): Promise<AuthTokens | null> => {
    try {
      const refreshToken = tokenManager.getRefreshToken();
      if (!refreshToken) return null;
      const res = await apiClient.post<ApiResponse<AuthTokens>>('/auth/refresh', { refreshToken });
      const data = res.data.data!;
      tokenManager.saveTokens(data.accessToken, data.refreshToken);
      return data;
    } catch {
      return null;
    }
  },
};
