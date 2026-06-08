# Known Issues — Tổng hợp

> **Đọc file này trước khi phát triển hoặc QA.** Liệt kê mọi điểm chưa tối ưu, chưa hoàn thiện, hoặc chưa đúng trong hệ thống.

## Tóm tắt theo mức độ

| Mức | Số lượng ước tính | Ví dụ |
|-----|-------------------|-------|
| ❌ Lỗi / bảo mật | ~8 | Role tự chọn khi register, JWT secret placeholder, CORS `*` |
| 🔧 Chưa hoàn thiện | ~12 | Entry test stub, learning path UI, profile name edit |
| ⚠️ Chưa tối ưu | ~15 | In-memory sessions, fire-and-forget, sequential LLM |
| ✅ Hoàn thiện | Phần lớn CRUD + UI chính | Classes, documents, quiz pool, AI chat |

## Chi tiết theo tầng

- [web-gaps.md](web-gaps.md) — Frontend React
- [server-gaps.md](server-gaps.md) — Backend .NET
- [agent-gaps.md](agent-gaps.md) — AI Agent Python
- [cross-layer-inconsistencies.md](cross-layer-inconsistencies.md) — Mâu thuẫn giữa các tầng

## Top 10 vấn đề cần ưu tiên sửa

| # | Vấn đề | Tầng | Mức |
|---|--------|------|-----|
| 1 | `RegisterRequest.Role` client-controlled — đăng ký teacher tự do | server | ❌ |
| 2 | Không verify teacher ownership khi update/delete class | server | ❌ |
| 3 | JWT secret `CHANGE_ME_IN_PRODUCTION` trong appsettings | server | ❌ |
| 4 | CORS `AllowAnyOrigin` cả 3 tầng | server + agent | ❌ |
| 5 | `GenerateEntryTestAsync` stub placeholder, không gọi AI | server | 🔧 |
| 6 | Entry test: 3 implementation song song (legacy UI, placement, agent orphan) | cross-layer | 🔧 |
| 7 | `learningPath.service.ts` không có UI consumer | web | 🔧 |
| 8 | Placement test route không có nav link | web | 🔧 |
| 9 | Placement + Practice sessions in-memory — mất khi restart | server | ⚠️ |
| 10 | Agent `agent_sessions` in-memory — không multi-instance | agent | ⚠️ |

## Tài liệu cũ đã lỗi thời

| File | Vấn đề |
|------|--------|
| `docs/implementation-plan.md` | Nhiều mục "chưa có" đã implement (UserProfile, BKT DB, Admin, chat history) |
| `docs/web-technical-spec.md` | Mô tả hooks/, sidebar riêng, analytics pages — không tồn tại |
| `docs/features.md` | Demo login buttons, teacher analytics UI — không có |

Xem header DEPRECATED trong từng file cũ.

## Cách gắn badge trong docs mới

Mọi file trong `01-web/`, `02-server/`, `03-ai-agent-core/` dùng badge ở đầu file và trong bảng hàm. Khi sửa code, cập nhật badge tương ứng.
