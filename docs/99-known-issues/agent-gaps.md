# Known Issues — AI Agent Core (Python)

## ❌ Chưa đúng / lỗi

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| CORS open | `main.py` | `allow_origins=["*"]` |

## 🔧 Chưa hoàn thiện

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| `config.py` unused | `core/config.py` | Toàn bộ constants không được import |
| `BATCH_QUIZ_TEMPLATE` dead | `prompt_templates.py` | Định nghĩa nhưng không dùng |
| Orphan endpoints | `main.py` | `/entry-test/*`, `/spaced-repetition/update` không được .NET gọi |
| No `__init__.py` | `src/` | Import fragile qua sys.path |
| No API integration tests | `tests/` | Chỉ unit tests core/rag/parser |
| vLLM orchestrator | `ai-agent-core/docs/06_ai_server.md` | Mô tả nhưng chưa implement |
| `.docx` in directory ingest | `ingest.py` | `process_directory` chỉ .pdf/.txt; `DocumentReader` hỗ trợ .docx |

## ⚠️ Chưa tối ưu

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| In-memory tutor sessions | `main.py` | `agent_sessions` dict — mất restart, không scale |
| In-memory entry test | `main.py` | `entry_test_sessions` dict |
| Sequential batch quiz | `main.py` | `MAX_CONCURRENT = 1` |
| Partial batch return | `main.py` | Có thể trả ít câu hơn yêu cầu |
| Dual RAG paths | `rag/` | API dùng simple retriever; `RAGPipeline`+reranker không expose HTTP |
| Monolithic main.py | `main.py` | ~1350 lines — parsers + endpoints + helpers |
| `CHAT_MAX_HISTORY` unused | `config.py` | Hardcoded 5 messages in chat |
| `RAG_SIMILARITY_THRESHOLD` unused | `config.py` | Không filter score |
| `LLM_TIMEOUT_SECONDS` unused | `config.py` | OpenAI client no explicit timeout |
| No `.env.example` | — | Env vars không documented in repo |

## Liên kết

- [../03-ai-agent-core/README.md](../03-ai-agent-core/README.md)
- [cross-layer-inconsistencies.md](cross-layer-inconsistencies.md)
