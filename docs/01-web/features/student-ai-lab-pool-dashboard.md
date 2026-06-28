# Student Quiz Pool

> Trạng thái: ✅ | Route: `/student/quiz-pool` | Role: student

## Mục đích

Trang quản lý kho câu hỏi AI cá nhân, tạo bộ ôn tập, và **bắt đầu phiên luyện tập** (redirect sang practice-session).

## File nguồn

[`web/src/features/ai-lab/pool-dashboard.tsx`](../../../web/src/features/quiz-pool/pages/student-pool-dashboard.tsx)

## Routes

- `/student/quiz-pool` — browse pool, revision sets, generate
- `/student/practice-session?mode=fixed&...` — play session (server-backed)

## Làm bài / Ôn luyện

Nút **Làm bài** (tab Pool) hoặc **Ôn luyện** (tab Revision) redirect tới:

```
/student/practice-session?mode=fixed&topicId={topicId}&questionIds={ids}&topicName={title}
```

- Tab Pool: `topicId` từ topic đang chọn
- Tab Revision: load questions qua `GET /quizzes/my/{quizId}/questions`, không bắt buộc `topicId`

Kết thúc phiên cập nhật BKT, lịch ôn tập, streak, dashboard stats.

## API / Services

- `pool.service.ts` — pool CRUD, revision sets
- `quizzes.service.ts` — load câu hỏi revision set trước khi redirect
- `practiceSession.service.ts` — `startFixed` khi play

## State management

- TanStack React Query (`useQuery` / `useMutation`) trên dashboard
- Practice session dùng mutations + invalidate sau `endSession`

## Liên kết

- [routing.md](../routing.md)
- [flows/05-quiz-pool-student.md](../../04-integration/flows/05-quiz-pool-student.md)
- [flows/12-practice-session.md](../../04-integration/flows/12-practice-session.md)
