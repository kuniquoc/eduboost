# Known Issues — Tổng hợp

> **Đọc file này trước khi phát triển hoặc QA.** Liệt kê mọi điểm chưa tối ưu, chưa hoàn thiện, hoặc chưa đúng trong hệ thống.

## Tóm tắt theo mức độ (cập nhật 2026-06-10 — post audit)

| Mức | Số lượng ước tính | Ví dụ còn lại |
|-----|-------------------|---------------|
| ❌ Lỗi / bảo mật | ~0 | Pool/Topics/Quizzes IDOR đã fix |
| 🔧 Chưa hoàn thiện | ~2 | Mobile vẫn dùng legacy entry-test; vLLM orchestrator |
| ⚠️ Chưa tối ưu | ~1 | vLLM orchestrator (future) |
| ✅ Đã xử lý gần đây | Nhiều | RBAC pool, student delete, EXPLAIN flow, chat topic_id, docs sync |

## Chi tiết theo tầng

- [web-gaps.md](web-gaps.md) — Frontend React
- [server-gaps.md](server-gaps.md) — Backend .NET
- [agent-gaps.md](agent-gaps.md) — AI Agent Python
- [cross-layer-inconsistencies.md](cross-layer-inconsistencies.md) — Mâu thuẫn giữa các tầng

## Top ưu tiên còn lại

| # | Vấn đề | Tầng | Mức |
|---|--------|------|-----|
| 1 | Mobile entry-test → migrate sang placement-tests | mobile | 🔧 |
| 2 | vLLM orchestrator (future) | agent | 🔧 |

## Cách gắn badge trong docs mới

Mọi file trong `01-web/`, `02-server/`, `03-ai-agent-core/` dùng badge ở đầu file và trong bảng hàm. Khi sửa code, cập nhật badge tương ứng.
