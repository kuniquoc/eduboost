# Store & Types

## auth-store ([`store/auth-store.ts`](../../web/src/store/auth-store.ts))

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

## types/index.ts ([`types/index.ts`](../../web/src/types/index.ts))

Shared TypeScript interfaces ported từ mobile:

| Nhóm | Types chính |
|------|-------------|
| Auth | `User`, `AuthTokens`, `ApiResponse<T>` |
| Classes | `ClassDto`, `ClassDetailDto`, `StudentEnrollmentDto` |
| Documents | `DocumentDto`, `UploadUrlDto`, `GenerateQuizJobDto` |
| Quizzes | `QuestionDto`, `QuizDto`, `EntryTestDto`, `TutorNextActionDto` |
| Pool | `TopicPoolDto`, `PoolQuizDetailDto`, `GeneratePoolQuizRequest` |
| Learning | `BktStateDto`, `ReviewScheduleDto`, `RoadmapDto`, `LearningPathDto` |
| Placement | `PlacementTestResultDto`, `StartPlacementTestResponse` |
| Chat | `ChatMessageDto`, `AskAiRequest` |

## lib/

| File | Export | Trạng thái |
|------|--------|------------|
| `utils.ts` | `cn()` clsx + tailwind-merge | ✅ |
| `constants.ts` | Partial `ROUTES` | ⚠️ Thiếu nhiều route |

## utils/

| File | Mô tả |
|------|-------|
| `text-normalization.ts` | LaTeX → Unicode cho tutor/practice display |
