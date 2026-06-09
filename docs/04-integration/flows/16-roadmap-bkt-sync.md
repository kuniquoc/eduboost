# Luồng: Roadmap + BKT sync

> Trạng thái: ✅

## Tổng quan

Lộ trình học tập thống nhất qua **Roadmap theo lớp** (`/api/roadmap/{classId}`), lưu trong `personalized_learning_paths`. API `/api/learning-paths/*` đã gỡ.

## Nguồn chủ đề

- Bảng `topics` với `ClassId` — giáo viên tạo qua `POST /api/classes/{classId}/topics`
- Roadmap chỉ gồm topic thuộc lớp (`Topic.ClassId == classId`)

## Trigger cập nhật

| Sự kiện | Hành động server |
|---------|------------------|
| Hoàn thành placement test | `GenerateAsync` — ưu tiên weak topics từ entry test + BKT seed |
| Nộp entry test legacy (quiz) | `GenerateAsync` — mobile/web legacy |
| Kết thúc practice session | `SyncAfterLearningAsync` — mark complete nếu mastery ≥ 0.95, reorder |
| Tutor submit answer | `SyncAfterLearningAsync` |
| Giáo viên thêm topic | `EnsureClassTopicsSyncedAsync` cho học sinh đã làm entry test |
| GET roadmap khi thiếu path/topic | `GenerateAsync` hoặc `EnsureClassTopicsSyncedAsync` |

## Thuật toán sync sau học

1. Cập nhật `RecommendedDifficulty`, `PriorityScore = 1 - mastery`
2. `IsCompleted = true` khi `mastery >= 0.95`
3. Reorder các bước chưa hoàn thành theo mastery tăng dần (yếu nhất trước)

## UI

| Layer | Màn hình |
|-------|----------|
| web | `roadmap-page.tsx` — theo lớp; nav "Lộ trình học" → Lớp học |
| web | Practice invalidate `['roadmap']` khi mastered / end session |
| mobile | Entry test → roadmap tự tạo; xem tại tab lớp |

## Liên kết

- [RoadmapRepository.cs](../../../server/Features/Roadmap/RoadmapRepository.cs)
- [cross-layer-inconsistencies.md](../../99-known-issues/cross-layer-inconsistencies.md)
