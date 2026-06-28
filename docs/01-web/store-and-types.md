# Store & Types

## auth-store ([`store/auth-store.ts`](../../web/src/features/auth/auth-store.ts))

> Trạng thái: ✅

| Hàm / State | Mô tả | Trạng thái |
|-------------|-------|------------|
| `user` | `User \| null` | ✅ |
| `isAuthenticated` | boolean | ✅ |
| `isLoading` | Init/ logout loading | ✅ |
| `initialize()` | getMe hoặc refresh từ localStorage | ✅ |
| `setAuth(user)` | Sau login/register | ✅ |
| `logout()` | revoke + clear tokens | ✅ |
| `setLoading(v)` | UI loading flag | ✅ |

Đăng ký `setOnLogoutCallback` để axios interceptor gọi logout khi refresh fail.

## Types theo domain

DTO được đặt cạnh feature sở hữu; không có barrel `types/index.ts` dùng chung:

| Nhóm | Types chính |
|------|-------------|
| Auth | `features/auth/types.ts` |
| Classes | `features/classes/types.ts` |
| Documents | `features/documents/types.ts` |
| Quizzes | `features/quizzes/types.ts` |
| Pool | `features/quiz-pool/types.ts` |
| Practice/placement | `features/practice/types.ts`, `shared/types/learning.ts` |
| Chat/admin | `features/ai-chat/types.ts`, `features/admin/types.ts` |
| API envelope | `shared/api/types.ts` |

## shared/lib/

| File | Export | Trạng thái |
|------|--------|------------|
| `utils.ts` | `cn()` clsx + tailwind-merge | ✅ |
| `constants.ts` | `ROUTES` — đầy đủ routes trong App.tsx | ✅ |

`text-normalization.ts` chuẩn hóa LaTeX cho tutor/practice display.
