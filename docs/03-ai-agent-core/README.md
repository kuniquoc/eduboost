# AI Agent Core Documentation

FastAPI service tại [`ai-agent-core/`](../../ai-agent-core/).

## Mục lục

| Doc | Nội dung |
|-----|----------|
| [architecture.md](architecture.md) | 3 layers: API, core, RAG |
| [api/endpoints.md](api/endpoints.md) | 16 HTTP endpoints |
| [api/quiz-parsers.md](api/quiz-parsers.md) | Parser helpers trong main.py |
| [core/](core/) | BKT, IRT, orchestrator, entry_test, spaced_repetition |
| [adapters/](adapters/) | LLMManager, prompt templates |
| [rag/](rag/) | FAISS, ingest, retriever, pipeline |
| [flows/](flows/) | Tutor, batch quiz, RAG |

## Training docs (riêng)

Lý thuyết và training pipeline: [`ai-agent-core/docs/`](../../ai-agent-core/docs/)

| File | Nội dung |
|------|----------|
| `01_ke_hoach_tong_quan.md` | Kế hoạch tổng quan |
| `02_bkt_va_irt.md` | BKT + IRT theory |
| `05_rag.md` | RAG architecture |
| `06_ai_server.md` | vLLM plan — **chưa implement** 🔧 |

## Run

```bash
uvicorn src.api.main:app --host 0.0.0.0 --port 8000
```

Docker: [`ai-agent-core/Dockerfile`](../../ai-agent-core/Dockerfile)

## Known issues

[../99-known-issues/agent-gaps.md](../99-known-issues/agent-gaps.md)
