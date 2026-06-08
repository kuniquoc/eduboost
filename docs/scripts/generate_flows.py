#!/usr/bin/env python3
"""Generate integration flow documentation files."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "04-integration" / "flows"

FLOWS = [
    ("01-auth-token-rotation", "Auth + Token Rotation", "Login/Register", "web/services/api.ts, server/Features/Auth/", "POST /api/auth/*", "✅", "Admin redirect sau login chưa tối ưu"),
    ("02-document-upload-rag", "Upload tài liệu + RAG Ingest", "Upload file trong Documents tab / AI Lab", "DocumentsRepository.cs, main.py", "POST .../request-upload, /rag/ingest", "⚠️", "Ingest fire-and-forget; doc ready khi ingest fail"),
    ("03-generate-quiz-from-document", "Generate Quiz từ Document", "Quiz generation dialog", "DocumentsRepository.cs, /tutor/generate-quiz", "POST .../generate-quiz", "✅", "Sync blocking, timeout 600s batch client"),
    ("04-quiz-pool-teacher", "Quiz Pool Teacher", "Teacher pool dashboard", "PoolRepository.cs, pool-dashboard.tsx", "POST /api/pool/generate, create-test", "✅", "—"),
    ("05-quiz-pool-student", "Quiz Pool Student Revision", "Student pool dashboard", "PoolRepository.cs", "POST create-revision-set, GET revision-sets", "⚠️", "revision-sets gọi inline apiClient"),
    ("06-ai-studio-publish", "AI Studio Review + Publish", "Quiz review page", "quiz-review-page.tsx, QuizzesRepository.cs", "/api/quizzes/{id}/questions, publish", "✅", "—"),
    ("07-entry-test-legacy", "Entry Test Legacy", "Dashboard redirect → entry-test page", "QuizzesRepository.GenerateEntryTestAsync", "generate-entry-test, entry-test/submit", "🔧", "Generator stub placeholder; không AI thật"),
    ("08-placement-test", "Placement Test Adaptive", "Route /student/placement-test", "PlacementTestsRepository.cs", "/api/placement-tests/*", "⚠️", "In-memory session; không nav link"),
    ("09-roadmap", "Roadmap Generate + Steps", "Roadmap page", "RoadmapRepository.cs", "/api/roadmap/*", "✅", "—"),
    ("10-ai-tutor-practice", "AI Tutor Practice", "Practice page", "QuizzesController tutor endpoints", "/api/quizzes/tutor/*", "⚠️", "BKT update fire-and-forget; mastery null"),
    ("11-bkt-review-schedule", "BKT + Review Schedule", "Dashboard, review page", "LearningStatesRepository.cs", "/api/learning-states/*", "✅", "Agent SM-2 endpoint không dùng"),
    ("12-practice-session", "Practice Session", "Review → practice-session", "PracticeSessionsRepository.cs", "/api/practice-sessions/*", "⚠️", "In-memory sessions"),
    ("13-ai-chat-rag", "AI Chat RAG", "AI chat page", "AiChatRepository.cs, /tutor/chat", "/api/ai-chat/*", "✅", "Không streaming"),
    ("14-ai-lab", "AI Lab Student Docs", "AI Lab page", "DocumentsRepository student scope", "/api/documents/my/*", "✅", "—"),
    ("15-learning-paths", "Learning Paths API", "— no UI", "LearningPathsRepository.cs", "/api/learning-paths/*", "🔧", "learningPath.service không có consumer"),
    ("16-admin-dashboard", "Admin Dashboard", "Admin dashboard", "AdminController.cs", "/api/admin/*", "✅", "Cần tạo admin user thủ công"),
    ("17-class-lifecycle", "Class Lifecycle", "Teacher/Student classes", "ClassesRepository.cs", "/api/classes/*", "⚠️", "Không verify teacher ownership"),
    ("18-topic-ai-evaluate", "Topic AI Evaluate", "Topics tab AI evaluate", "TopicsRepository.AiEvaluateAsync", "POST topics/ai-evaluate", "🔧", "Heuristic không gọi agent"),
]

TEMPLATE = '''# Luồng: {title}

> Trạng thái: {status}

## Trigger

{trigger}

## Sequence diagram

```mermaid
sequenceDiagram
    actor User
    participant Web as web
    participant API as server
    participant Agent as ai-agent-core
    participant DB as PostgreSQL
    User->>Web: {trigger_short}
    Web->>API: REST call
    API->>DB: Persist / query
    opt AI required
        API->>Agent: HTTP tutor/rag
        Agent-->>API: JSON response
    end
    API-->>Web: ApiResponse
    Web-->>User: UI update
```

## Bảng bước

| Step | Layer | File / Module | API / Endpoint | Ghi chú |
|------|-------|---------------|----------------|---------|
| 1 | web | See integration map | — | User action |
| 2 | web | Service layer | REST | JWT attached |
| 3 | server | {server_files} | {apis} | Repository logic |
| 4 | server | AgentService (if any) | Agent HTTP | Graceful degradation |
| 5 | web | React Query invalidate | — | UI refresh |

## Error paths & fallback

- **401:** Axios refresh queue → retry hoặc logout
- **Agent offline:** Tutor/chat trả placeholder; quiz generation fail message
- **Upload fail:** Toast error, document status `pending` không confirm

## Trạng thái & hạn chế

{gap}

## Liên kết

- [web-server-agent-map.md](../web-server-agent-map.md)
- [../../99-known-issues/index.md](../../99-known-issues/index.md)
'''

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index_lines = ["# Integration Flows\n", "Danh sách 18 luồng end-to-end.\n", "| # | Luồng | Trạng thái | File |", "|---|-------|------------|------|"]
    for i, (slug, title, trigger, server, apis, status, gap) in enumerate(FLOWS, 1):
        content = TEMPLATE.format(
            title=title,
            status=status,
            trigger=trigger,
            trigger_short=trigger[:40],
            server_files=server,
            apis=apis,
            gap=gap,
        )
        path = OUT / f"{slug}.md"
        path.write_text(content, encoding="utf-8")
        index_lines.append(f"| {i} | {title} | {status} | [{slug}.md]({slug}.md) |")
        print(f"Wrote {slug}.md")
    (OUT / "README.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
