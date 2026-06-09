# Review Schedule

> Trạng thái: ✅ | Route: `/student/review` | Role: student

## Mục đích

Lịch ôn tập Spaced Repetition — hiển thị câu due, mốc SM-2, và khởi chạy phiên ôn.

## File nguồn

[`web/src/features/student/review/review-page.tsx`](../../../web/src/features/student/review/review-page.tsx)

## Tính năng

- Tổng số câu due hôm nay
- Mastery overview theo chủ đề (BKT)
- Mỗi item: preview câu hỏi, mốc (1 ngày / 6 ngày / …), retention, quá hạn
- **Ôn tất cả hôm nay** → `/student/practice-session?mode=review`
- **Ôn tập** từng câu → `mode=review&questionIds=...`

## API / Services

- `learningStateService.getReviewSchedule`
- `learningStateService.getStates`

## Liên kết

- [flows/11-bkt-review-schedule.md](../../04-integration/flows/11-bkt-review-schedule.md)
