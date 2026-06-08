# Feature: UserProfiles

> Thư mục: [`server/Features/UserProfiles/`](../../../server/Features/UserProfiles/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `api/user-profiles/me` | `GetMyProfile` |
| PUT | `api/user-profiles/me` | `UpdateMyProfile` |
| GET | `api/user-profiles/{userId:guid}` | `GetUserProfile` |

## Repository methods

| Method |
|--------|
| `GetProfileAsync` |
| `UpdateProfileAsync` |
| `GetProfileByUserIdAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
