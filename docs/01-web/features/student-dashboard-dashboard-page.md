# Student Dashboard

> Trạng thái: ✅ | Route: `/student/dashboard` | Role: student

## Mục đích

Trang tổng quan tiến độ học tập của học sinh.

## File nguồn

[`web/src/features/student/dashboard/dashboard-page.tsx`](../../../web/src/features/student/dashboard/dashboard-page.tsx)

## Routes

- `/student/dashboard`

## API / Services

| UI | API | Service / Hook |
|----|-----|----------------|
| 3 stat cards | `GET /api/students/me/stats` | `useStudentStats` → `studentsService.getMyStats` |
| Lớp học đang tham gia | `GET /api/students/me/progress` | `useStudentProgress` |
| Nhắc ôn tập | `GET /api/learning-states/me/review-schedule` | `useReviewSchedule` |

## Chỉ số hiển thị

| Card | Field | Ý nghĩa |
|------|-------|---------|
| Chuỗi ngày | `dayStreak` | Ngày UTC liên tiếp có hoạt động (quiz hoặc luyện tập) |
| Bài đã làm | `totalQuizzesTaken` | Tổng quiz đã nộp + phiên luyện tập đã kết thúc |
| Tỉ lệ đúng tuần này | `weeklyProgress` | % câu trả lời đúng trong tuần hiện tại (thứ Hai UTC) |

Không hiển thị **Điểm TB** (`avgQuizScore`) và **Tiến độ tổng thể** (`overallProgress`) trên trang này.

Công thức chi tiết: [api-reference.md](../../04-integration/api-reference.md) → `GET /api/students/me/stats`.

## State management

- TanStack React Query (`useQuery` / `useMutation`)
- Zustand `auth-store` cho user/role

## Điểm chưa tối ưu / chưa hoàn thiện

Entry test redirect logic

## Liên kết

- [routing.md](../routing.md)
- [flows](../../04-integration/flows/)
