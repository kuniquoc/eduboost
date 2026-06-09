# Known Issues — AI Agent Core (Python)

## ❌ Chưa đúng / lỗi

_Không còn mục critical sau audit 2026-06-10._

## 🔧 Chưa hoàn thiện

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| vLLM orchestrator | `docs/06_ai_server.md` | Mô tả nhưng chưa implement |

## ⚠️ Chưa tối ưu

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| Orphan tutor session API | `routes/tutor.py` | `/tutor/next-action`, `/tutor/update-state` |
| Partial batch return | `quiz_batch_service.py` | Có thể trả ít câu hơn yêu cầu |
| Dual RAG paths | `rag/` | API dùng simple retriever |
| Config constants unused | `core/config.py` | `BKT_*`, `VECTOR_SEARCH_TIMEOUT` |

## ✅ Đã xử lý (2026-06-10 audit + follow-up)

| Vấn đề | Giải pháp |
|--------|-----------|
| Chat RAG ignores topic_id | Search dùng biến `query` (topic + question) |
| Ingest delete before success | Delete chunks sau khi parse/validate text |
| Chat 200 khi LLM down | Dùng `raise_ai_unavailable()` → 503 |
| MAX_NUM_QUESTIONS | Cap trong `quiz_batch_service.py` |
| `_tutor_extract.py` artifact | Đã xóa |
| `AGENT_SESSION_DIR` | Thêm vào `.env.example` |
| Batch concurrency hardcoded | `QUIZ_BATCH_MAX_CONCURRENT` env (default 1) |
| Session store doc | File-backed pickle (`session_store.py`) |

## Liên kết

- [../03-ai-agent-core/README.md](../03-ai-agent-core/README.md)
- [cross-layer-inconsistencies.md](cross-layer-inconsistencies.md)
