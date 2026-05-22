import axios, { type AxiosRequestConfig } from 'axios';

// ── Token storage (localStorage for web) ──────────────────────────────────────
const ACCESS_TOKEN_KEY = 'eduboost_access_token';
const REFRESH_TOKEN_KEY = 'eduboost_refresh_token';

export const tokenManager = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),

  saveTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  clearTokens: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// ── Logout callback (avoids circular import with authStore) ───────────────────
type LogoutListener = () => void;
let _onLogout: LogoutListener | null = null;
export function setOnLogoutCallback(cb: LogoutListener) {
  _onLogout = cb;
}

// ── Axios instance ────────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120_000, // 120s — LLM calls via AI Agent can be slow
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach Bearer token ─────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = tokenManager.getAccessToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

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

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry auth endpoints to avoid infinite loops
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
        const refreshToken = tokenManager.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const baseURL = apiClient.defaults.baseURL;
        const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });

        const { accessToken, refreshToken: newRefresh } = res.data.data;
        tokenManager.saveTokens(accessToken, newRefresh);
        processQueue(null, accessToken);

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        tokenManager.clearTokens();
        _onLogout?.();
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
