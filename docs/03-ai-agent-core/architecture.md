# AI Agent Architecture

```mermaid
flowchart TB
    subgraph api [api/main.py]
        Endpoints[16 FastAPI endpoints]
        Parsers[Quiz parsers + validators]
        Sessions[agent_sessions dict]
    end
    subgraph core [core/]
        BKT[bkt.py]
        IRT[irt.py]
        Orch[orchestrator.py]
        Entry[entry_test.py]
        SR[spaced_repetition.py]
        Config[config.py unused]
    end
    subgraph adapters [adapters/]
        LLM[llm_manager.py]
        Prompts[prompt_templates.py]
    end
    subgraph rag [rag/]
        VDB[vector_db.py FAISS]
        Ret[retriever.py]
        Ing[ingest.py]
        Pipe[pipeline.py not exposed]
    end
    Endpoints --> Orch
    Endpoints --> LLM
    Endpoints --> Ret
    Orch --> BKT
    Orch --> IRT
    Ret --> VDB
    Ing --> VDB
```

## Startup (lifespan)

1. Load FAISS index (`FAISS_INDEX_PATH`)
2. Init `VectorDB`, `KnowledgeRetriever`, `RAGIngestor`
3. Auto-ingest `data/raw/` nếu index empty
4. Init `LLMManager` quiz + explain roles
5. Graceful degradation nếu RAG/LLM fail

## In-memory state ⚠️

| Dict | Key | Mất khi |
|------|-----|---------|
| `agent_sessions` | student_id | Restart / scale |
| `entry_test_sessions` | session_id | Restart |

## Dual RAG paths

| Path | Used by | Reranker |
|------|---------|----------|
| API | `/rag/*`, tutor endpoints | No |
| RAGPipeline | CLI `test_pipeline.py` | Yes |

## Liên kết

- [api/endpoints.md](api/endpoints.md)
- [../04-integration/web-server-agent-map.md](../04-integration/web-server-agent-map.md)
