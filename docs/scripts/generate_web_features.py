#!/usr/bin/env python3
"""Generate web feature page documentation."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FEATURES = ROOT / "web" / "src" / "features"
OUT = ROOT / "docs" / "01-web" / "features"

FEATURES_MAP = [
    ("landing/landing-page.tsx", "Landing", "/", "Public", "✅", "—"),
    ("auth/login-page.tsx", "Login", "/login", "Public", "⚠️", "Không có demo login; admin redirect"),
    ("auth/register-page.tsx", "Register", "/register", "Public", "⚠️", "Role chọn từ client"),
    ("teacher/classes/classes-page.tsx", "Teacher Classes", "/teacher/classes", "teacher", "✅", "—"),
    ("teacher/classes/class-detail-page.tsx", "Class Detail", "/teacher/classes/:id", "teacher", "✅", "Tabs: topics, docs, students, quizzes"),
    ("teacher/classes/tabs/topics-tab.tsx", "Topics Tab", "(tab)", "teacher", "⚠️", "AI evaluate = heuristic backend"),
    ("teacher/classes/tabs/documents-tab.tsx", "Documents Tab", "(tab)", "teacher", "✅", "—"),
    ("teacher/classes/tabs/students-tab.tsx", "Students Tab", "(tab)", "teacher", "✅", "—"),
    ("teacher/classes/tabs/quizzes-tab.tsx", "Quizzes Tab", "(tab)", "teacher", "✅", "—"),
    ("teacher/quizzes/quiz-review-page.tsx", "AI Studio", "/teacher/ai-studio/:quizId", "teacher", "✅", "—"),
    ("teacher/quizzes/pool-dashboard.tsx", "Teacher Quiz Pool", "/teacher/quiz-pool", "teacher", "⚠️", "revision-sets inline API"),
    ("student/dashboard/dashboard-page.tsx", "Student Dashboard", "/student/dashboard", "student", "✅", "Entry test redirect logic"),
    ("student/classes/classes-page.tsx", "Student Classes", "/student/classes", "student", "⚠️", "Luôn link roadmap"),
    ("student/entry-test/entry-test-page.tsx", "Entry Test", "/student/entry-test/:classId", "student", "🔧", "Legacy; generator stub"),
    ("student/placement-test/adaptive-placement-test-page.tsx", "Placement Test", "/student/placement-test", "student", "🔧", "Không nav link"),
    ("student/roadmap/roadmap-page.tsx", "Roadmap", "/student/roadmap/:classId", "student", "✅", "—"),
    ("student/practice/practice-page.tsx", "AI Tutor Practice", "/student/practice/:topicId", "student", "⚠️", "BKT async"),
    ("student/practice-session/practice-session-page.tsx", "Practice Session", "/student/practice-session", "student", "⚠️", "Không sidebar"),
    ("student/ai-chat/ai-chat-page.tsx", "AI Chat", "/student/ai-chat", "student", "✅", "No streaming"),
    ("student/review/review-page.tsx", "Review Schedule", "/student/review", "student", "✅", "—"),
    ("student/ai-lab/ai-lab-page.tsx", "AI Lab", "/student/ai-lab", "student", "✅", "—"),
    ("student/ai-lab/ai-lab-quiz-page.tsx", "AI Lab Quiz Review", "/student/ai-lab/:quizId", "student", "✅", "—"),
    ("student/ai-lab/pool-dashboard.tsx", "Student Quiz Pool", "/student/quiz-pool", "student", "✅", "—"),
    ("shared/profile-page.tsx", "Profile", "/teacher|student/profile", "all", "🔧", "Name edit chưa khả dụng"),
    ("admin/admin-dashboard-page.tsx", "Admin Dashboard", "/admin/dashboard", "admin", "✅", "—"),
]

TEMPLATE = '''# {name}

> Trạng thái: {status} | Route: `{route}` | Role: {role}

## Mục đích

Trang/feature `{name}` trong EduBoost web app.

## File nguồn

[`web/src/features/{file}`](../../../web/src/features/{file})

## Routes

- `{route}`

## API / Services

Xem [web-server-agent-map.md](../../04-integration/web-server-agent-map.md) và [services/](../services/).

## State management

- TanStack React Query (`useQuery` / `useMutation`)
- Zustand `auth-store` cho user/role

## Điểm chưa tối ưu / chưa hoàn thiện

{gap}

## Liên kết

- [routing.md](../routing.md)
- [flows](../../04-integration/flows/)
'''

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = ["# Web Features\n", "| Feature | Route | Status | Doc |", "|---------|-------|--------|-----|"]
    for file, name, route, role, status, gap in FEATURES_MAP:
        slug = file.replace("/", "-").replace(".tsx", "")
        content = TEMPLATE.format(name=name, status=status, route=route, role=role, file=file, gap=gap)
        (OUT / f"{slug}.md").write_text(content, encoding="utf-8")
        index.append(f"| {name} | `{route}` | {status} | [{slug}.md]({slug}.md) |")
    (OUT / "README.md").write_text("\n".join(index) + "\n", encoding="utf-8")
    print(f"Wrote {len(FEATURES_MAP)} feature docs")

if __name__ == "__main__":
    main()
