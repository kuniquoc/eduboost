# Luồng: Auth + Token Rotation

> Trạng thái: ✅ (core); ⚠️ admin redirect

## Trigger

User submit login/register form hoặc app init với token trong localStorage.

## Sequence diagram

```mermaid
sequenceDiagram
    actor User
    participant Web as web/api.ts
    participant Auth as AuthController
    participant Repo as AuthRepository
    participant DB as PostgreSQL

    Note over User,DB: Login
    User->>Web: authService.login(email, password)
    Web->>Auth: POST /api/auth/login
    Auth->>Repo: LoginAsync
    Repo->>DB: Find User, BCrypt verify
    Repo->>Repo: Generate JWT + RefreshToken
    Repo->>DB: Save RefreshToken
    Auth-->>Web: ApiResponse AuthTokensDto
    Web->>Web: tokenManager.saveTokens(localStorage)

    Note over User,DB: Token Rotation on 401
    Web->>Auth: API call with expired JWT
    Auth-->>Web: 401
    Web->>Auth: POST /api/auth/refresh
    Auth->>Repo: RefreshTokenAsync
    Repo->>DB: Validate old token, revoke, issue new pair
    Auth-->>Web: New tokens
    Web->>Auth: Retry original request
```

## Bảng bước

| Step | Layer | File:Function | API | Ghi chú |
|------|-------|---------------|-----|---------|
| 1 | web | `login-page.tsx` submit | — | Form validation |
| 2 | web | `authService.login` | `POST /api/auth/login` | Save tokens |
| 3 | server | `AuthRepository.LoginAsync` | — | BCrypt + JWT 60m |
| 4 | web | `authStore.setAuth` | — | Navigate by role |
| 5 | web | `api.ts` interceptor | `POST /api/auth/refresh` | Queue on 401 |
| 6 | web | `authStore.initialize` | `GET /api/auth/me` | App boot |

## Hàm chính

| Hàm | File | Trạng thái |
|-----|------|------------|
| `login` | `auth.service.ts` | ✅ |
| `register` | `auth.service.ts` | ⚠️ role từ client |
| `initialize` | `auth-store.ts` | ✅ |
| `LoginAsync` | `AuthRepository.cs` | ✅ |
| `RefreshTokenAsync` | `AuthRepository.cs` | ✅ token rotation |

## Error paths

- Refresh fail → `setOnLogoutCallback` → clear tokens → redirect login
- Auth endpoints excluded from retry loop (tránh infinite loop)

## Trạng thái & hạn chế

- Login redirect: teacher → `/teacher/classes`, others → `/student/dashboard` — admin phải navigate thủ công ⚠️
- Register cho phép chọn role — server không validate ❌

## Liên kết

- [../web-server-agent-map.md](../web-server-agent-map.md)
- [../../01-web/services/auth.service.md](../../01-web/services/auth.service.md)
- [../../02-server/features/auth.md](../../02-server/features/auth.md)
