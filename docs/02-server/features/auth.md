# Feature: Auth

> Thư mục: [`server/Features/Auth/`](../../../server/Features/Auth/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| POST | `api/auth/login` | `Login` |
| POST | `api/auth/register` | `Register` (student only) |
| POST | `api/auth/refresh` | `Refresh` |
| POST | `api/auth/revoke` | `Revoke` |
| GET | `api/auth/me` | `GetMe` |
| PATCH | `api/auth/me/name` | `UpdateName` |
| POST | `api/auth/me/avatar` | `UploadAvatar` |

## Repository methods

| Method |
|--------|
| `LoginAsync` |
| `RegisterAsync` |
| `GetByIdAsync` |
| `RefreshTokenAsync` |
| `RevokeTokenAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
