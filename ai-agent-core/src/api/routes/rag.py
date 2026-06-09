import logging
import os
import tempfile

from fastapi import APIRouter, HTTPException

from src.api.app_state import runtime
from src.api.models import DeleteRequest, IngestRequest, RetrieveRequest
from src.rag.document_reader import DocumentReader

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/ingest")
async def ingest_document(request: IngestRequest):
    if not runtime.ingestor or not runtime.vector_db:
        raise HTTPException(503, "Ingestor or VectorDB not initialized")

    full_text = ""
    source_name = request.document_id

    if request.file_url:
        try:
            import requests

            logger.info("Downloading file for RAG ingestion: %s", request.file_url)
            response = requests.get(request.file_url, timeout=30)
            response.raise_for_status()

            parsed_url = request.file_url.split("?")[0]
            ext = os.path.splitext(parsed_url)[1].lower() or ".txt"
            source_name = os.path.basename(parsed_url)

            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp.write(response.content)
                tmp_path = tmp.name

            try:
                reader = DocumentReader()
                full_text = reader.load_document(tmp_path)
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception as cleanup_error:
                    logger.warning("Failed to delete temporary file %s: %s", tmp_path, cleanup_error)
        except Exception as e:
            logger.error("Error downloading or parsing document for RAG: %s", e)
            raise HTTPException(500, f"Failed to download or parse document: {str(e)}") from e
    elif request.text:
        full_text = request.text
    else:
        raise HTTPException(400, "Either text or file_url must be provided")

    if not full_text.strip():
        return {"status": "ok", "chunks_added": 0, "message": "Document has no content"}

    runtime.vector_db.delete_document_chunks(request.document_id)

    metadata = {
        "document_id": request.document_id,
        "scope": request.scope,
        "class_id": request.class_id,
        "owner_id": request.owner_id,
        "topic_id": request.topic_id,
    }

    chunks_added = runtime.ingestor.ingest_text_with_metadata(
        text=full_text,
        source_file=source_name,
        metadata=metadata,
    )

    return {"status": "ok", "chunks_added": chunks_added}


@router.post("/delete")
async def delete_document(request: DeleteRequest):
    if not runtime.vector_db:
        raise HTTPException(503, "VectorDB not initialized")
    runtime.vector_db.delete_document_chunks(request.document_id)
    return {"status": "ok", "message": f"Successfully deleted chunks for document {request.document_id}"}


@router.post("/retrieve")
async def retrieve_context(request: RetrieveRequest):
    if not runtime.vector_db:
        raise HTTPException(503, "VectorDB not initialized")
    results = runtime.vector_db.search(
        request.query,
        k=request.top_k,
        allowed_document_ids=request.allowed_document_ids,
        allowed_scopes=request.allowed_scopes,
    )
    return {"results": results}
