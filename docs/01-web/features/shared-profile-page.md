# Profile

> Trạng thái: ✅ | Route: `/teacher|student/profile` | Role: all

## Mục đích

Trang hồ sơ cá nhân — thông tin tài khoản và (với học sinh) chỉ số học tập.

## File nguồn

[`web/src/features/shared/profile-page.tsx`](../../../web/src/features/shared/profile-page.tsx)

## Routes

- `/teacher/profile`
- `/student/profile`

## API / Services

| UI (student) | API | Hook |
|--------------|-----|------|
| Thông tin tài khoản | `GET /api/auth/me` | `auth-store` |
| Trình độ, chủ đề yêu thích | `GET /api/user-profiles/me` | `useUserProfile` |
| Bài quiz đã làm | `GET /api/students/me/stats` | `useStudentStats` → `totalQuizzesTaken` |

## Chỉ số học sinh (hồ sơ)

Chỉ hiển thị **một** stat: `totalQuizzesTaken` (label "Bài quiz đã làm"). Các chỉ số điểm/thành thạo/chuỗi ngày chỉ có trên **Tổng quan** (`/student/dashboard`).

Section **Chủ đề yêu thích** (`profile.preferredTopics`) giữ riêng bên dưới.

## State management

- TanStack React Query (`useQuery` / `useMutation`)
- Zustand `auth-store` cho user/role

## Liên kết

- [routing.md](../routing.md)
- [student-dashboard-dashboard-page.md](student-dashboard-dashboard-page.md)
- [api-reference.md](../../04-integration/api-reference.md)
