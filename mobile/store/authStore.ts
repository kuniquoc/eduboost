import { create } from 'zustand';
import { setOnLogoutCallback, tokenManager } from '../services/api';
import { authService } from '../services/authService';
import type { User } from '../types';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Gọi khi app khởi động — đọc SecureStore, validate token, lấy user info */
  initialize: () => Promise<void>;
  setAuth: (user: User) => void;
  logout: () => Promise<void>;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => {
  // Đăng ký callback logout cho api.ts interceptor (tránh circular import)
  setOnLogoutCallback(async () => {
    await get().logout();
  });

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true, // true khi đang khởi động để tránh flash redirect

    initialize: async () => {
      set({ isLoading: true });
      try {
        const accessToken = await tokenManager.getAccessToken();
        if (!accessToken) {
          set({ isLoading: false, isAuthenticated: false, user: null });
          return;
        }
        // Token tồn tại → xác thực bằng GET /auth/me
        const user = await authService.getMe();
        set({ user, isAuthenticated: true });
      } catch {
        // Token hết hạn hoặc lỗi mạng → thử refresh
        try {
          const tokens = await authService.refreshToken();
          if (tokens) {
            set({ user: tokens.user, isAuthenticated: true });
          } else {
            await tokenManager.clearTokens();
            set({ user: null, isAuthenticated: false });
          }
        } catch {
          await tokenManager.clearTokens();
          set({ user: null, isAuthenticated: false });
        }
      } finally {
        set({ isLoading: false });
      }
    },

    setAuth: (user: User) => {
      set({ user, isAuthenticated: true });
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        await authService.logout();
      } catch {
        // Vẫn logout local dù server call thất bại
      } finally {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    setLoading: (isLoading) => set({ isLoading }),
  };
});
