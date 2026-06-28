FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ENV HF_HOME=/app/.cache/huggingface
RUN python -c "from sentence_transformers import SentenceTransformer; \
    SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

COPY src/ ./src/
COPY resources/ ./resources/

ENV PYTHONPATH=/app/src \
    FAISS_INDEX_PATH=/app/var/faiss/faiss_index \
    FAISS_SEED_PATH=/app/resources/faiss-seed/faiss_index

RUN mkdir -p /app/var/faiss

RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "eduboost_agent.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
