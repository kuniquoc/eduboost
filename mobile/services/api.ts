import axios, { AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// ── Config ────────────────────────────────────────────────────────────────────
// Emulator Android: 10.0.2.2, iOS Simulator: localhost, thiết bị thật: IP LAN
export const API_BASE_URL = 'http://192.168.1.2:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── SecureStore keys ──────────────────────────────────────────────────────────
const ACCESS_TOKEN_KEY = 'eduboost_access_token';
const REFRESH_TOKEN_KEY = 'eduboost_refresh_token';

// ── Token Manager ─────────────────────────────────────────────────────────────
export const tokenManager = {
  getAccessToken: async () => {
    const val = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    return val && val.trim() ? val : null;
  },
  getRefreshToken: async () => {
    const val = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    return val && val.trim() ? val : null;
  },

  saveTokens: async (accessToken: string, refreshToken: string) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  },

  clearTokens: async () => {
    // deleteItemAsync gọi native deleteValueWithKeyAsync — không tồn tại trên
    // một số môi trường (Expo Go cũ, web). Dùng try/catch với fallback.
    const safeDelete = async (key: string) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        try {
          // Fallback: ghi đè bằng chuỗi rỗng
          await SecureStore.setItemAsync(key, '');
        } catch {
          // Bỏ qua nếu cả hai đều thất bại
        }
      }
    };
    await safeDelete(ACCESS_TOKEN_KEY);
    await safeDelete(REFRESH_TOKEN_KEY);
  },
};

// ── Logout event emitter (tránh circular import với authStore) ─────────────────
type LogoutListener = () => void;
let _onLogout: LogoutListener | null = null;

export function setOnLogoutCallback(cb: LogoutListener) {
  _onLogout = cb;
}

// ── Request interceptor — attach Bearer token ─────────────────────────────────
apiClient.interceptors.request.use(
  async (config) => {
    const token = await tokenManager.getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — auto refresh on 401 ────────────────────────────────
let _isRefreshing = false;
let _failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  _failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  _failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Nếu là 401 và chưa retry lần nào
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Không retry các auth endpoint để tránh vòng lặp vô hạn / lỗi sai
      if (
        originalRequest.url?.includes('/auth/refresh') ||
        originalRequest.url?.includes('/auth/revoke') ||
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/register')
      ) {
        _onLogout?.();
        return Promise.reject(error);
      }

      if (_isRefreshing) {
        // Đang refresh rồi → đưa request vào hàng đợi
        return new Promise((resolve, reject) => {
          _failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      _isRefreshing = true;

      try {
        const refreshToken = await tokenManager.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        // Gọi refresh endpoint trực tiếp (không qua interceptor)
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefresh } = res.data.data;
        await tokenManager.saveTokens(accessToken, newRefresh);

        processQueue(null, accessToken);

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await tokenManager.clearTokens();
        _onLogout?.();
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }

    // Tất cả lỗi khác
    const message =
      error.response?.data?.message ||
      error.message ||
      'Đã xảy ra lỗi. Vui lòng thử lại.';
    return Promise.reject(new Error(message));
  }
);
