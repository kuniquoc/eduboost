# Feature: Admin

> Thư mục: [`server/Features/Admin/`](../../../server/Features/Admin/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `api/admin/users` | `GetUsers` |
| PUT | `api/admin/users/{id:guid}/role` | `UpdateRole` |
| DELETE | `api/admin/users/{id:guid}` | `DeleteUser` |
| GET | `api/admin/stats` | `GetStats` |

## Repository methods

| Method |
|--------|
| `UpdateRoleAsync` |
| `DeleteUserAsync` |
| `GetStatsAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
