import { apiClient, tokenManager } from './api';
import type { ApiResponse, AuthTokens, User } from '../types';

export const authService = {
  /** Đăng nhập — lưu tokens vào SecureStore */
  login: async (email: string, password: string): Promise<AuthTokens> => {
    const res = await apiClient.post<ApiResponse<AuthTokens>>('/auth/login', {
      email,
      password,
    });
    const data = res.data.data!;
    await tokenManager.saveTokens(data.accessToken, data.refreshToken);
    return data;
  },

  /** Đăng ký — lưu tokens vào SecureStore */
  register: async (
    name: string,
    email: string,
    password: string,
    role: string
  ): Promise<AuthTokens> => {
    const res = await apiClient.post<ApiResponse<AuthTokens>>('/auth/register', {
      name,
      email,
      password,
      role,
    });
    const data = res.data.data!;
    await tokenManager.saveTokens(data.accessToken, data.refreshToken);
    return data;
  },

  /** Lấy thông tin user hiện tại (dùng khi khởi động app) */
  getMe: async (): Promise<User> => {
    const res = await apiClient.get<ApiResponse<User>>('/auth/me');
    return res.data.data!;
  },

  /** Đăng xuất — thu hồi refresh token trên server + xóa SecureStore */
  logout: async (): Promise<void> => {
    try {
      const refreshToken = await tokenManager.getRefreshToken();
      if (refreshToken) {
        await apiClient.post('/auth/revoke', { refreshToken });
      }
    } catch {
      // Bỏ qua lỗi revoke (token đã hết hạn, server đã xóa...)
    } finally {
      await tokenManager.clearTokens();
    }
  },

  /** Làm mới access token thủ công (thường được gọi bởi interceptor tự động) */
  refreshToken: async (): Promise<AuthTokens | null> => {
    try {
      const refreshToken = await tokenManager.getRefreshToken();
      if (!refreshToken) return null;
      const res = await apiClient.post<ApiResponse<AuthTokens>>('/auth/refresh', {
        refreshToken,
      });
      const data = res.data.data!;
      await tokenManager.saveTokens(data.accessToken, data.refreshToken);
      return data;
    } catch {
      return null;
    }
  },
};
