# Feature: Auth

> Thư mục: [`server/Features/Auth/`](../../../server/Features/Auth/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| POST | `api/auth/login` | `Login` |
| POST | `api/auth/register` | `Register` |
| POST | `api/auth/refresh` | `Refresh` |

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
