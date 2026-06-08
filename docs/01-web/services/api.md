# Module: api.ts

> File: [`web/src/services/api.ts`](../../../web/src/services/api.ts)

## Vai trò

Axios instance, JWT token manager, 401 refresh interceptor.

## Hàm / Export

| Export | Mô tả | Trạng thái |
|--------|-------|------------|
| `tokenManager.getAccessToken` | Đọc localStorage | ✅ |
| `tokenManager.getRefreshToken` | Đọc localStorage | ✅ |
| `tokenManager.saveTokens` | Lưu access + refresh | ✅ |
| `tokenManager.clearTokens` | Xóa tokens | ✅ |
| `setOnLogoutCallback(cb)` | Đăng ký logout khi refresh fail | ✅ |
| `apiClient` | Axios instance base `/api`, timeout 120s | ✅ |

## Interceptor logic

1. Request: attach `Authorization: Bearer`
2. Response 401: queue requests, `POST /auth/refresh`, retry hoặc logout
3. Skip retry cho `/auth/login`, `/register`, `/refresh`, `/revoke`

## Known issues

- Tokens trong localStorage (XSS risk) — chấp nhận cho SPA dev
