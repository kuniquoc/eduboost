# Module: spaced_repetition.py

> File: [`ai-agent-core/src/core/spaced_repetition.py`](../../../ai-agent-core/src/core/spaced_repetition.py)

## Vai trò

**Reference implementation** của thuật toán SM-2 trong Python. Production path dùng [`SpacedRepetitionService.cs`](../../../server/Infrastructure/Services/SpacedRepetitionService.cs) trên server — logic `quality_from_response` đã được port sang C#.

## Core algorithms

| Kind | Name | Methods |
|------|------|---------|
| `class` | `SpacedRepetitionEngine` | `update_after_review`, `quality_from_response`, `get_review_schedule` |

## HTTP

Endpoint `/spaced-repetition/update` **không triển khai** trong `main.py`. Server tự tính SM-2 khi `LearningStatesRepository.UpdateAfterAnswerAsync` được gọi.

## Liên kết

- [learningstates.md](../../02-server/features/learningstates.md)
- [agent-gaps.md](../../99-known-issues/agent-gaps.md)
