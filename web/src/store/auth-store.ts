import { create } from 'zustand';
import { setOnLogoutCallback, tokenManager } from '@/services/api';
import { authService } from '@/services/auth.service';
import type { User } from '@/types';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialize: () => Promise<void>;
  setAuth: (user: User) => void;
  logout: () => Promise<void>;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => {
  setOnLogoutCallback(async () => {
    await get().logout();
  });

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,

    initialize: async () => {
      set({ isLoading: true });
      try {
        const accessToken = tokenManager.getAccessToken();
        if (!accessToken) {
          set({ isLoading: false, isAuthenticated: false, user: null });
          return;
        }
        const user = await authService.getMe();
        set({ user, isAuthenticated: true });
      } catch {
        try {
          const tokens = await authService.refreshToken();
          if (tokens) {
            set({ user: tokens.user, isAuthenticated: true });
          } else {
            tokenManager.clearTokens();
            set({ user: null, isAuthenticated: false });
          }
        } catch {
          tokenManager.clearTokens();
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
        // Still logout locally
      } finally {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    setLoading: (isLoading) => set({ isLoading }),
  };
});
