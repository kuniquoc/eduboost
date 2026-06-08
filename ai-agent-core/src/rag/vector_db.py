# src/rag/vector_db.py

import os
import pickle
import numpy as np
import faiss
import logging
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Tuple, Optional, Union

logger = logging.getLogger(__name__)

class VectorDB:
    """
    FAISS-backed vector database supporting Cosine Similarity and metadata synchronization.
    Maintains complete backwards compatibility with list of plain text operations.
    """

    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        index_path: str = "models/vector_db/faiss_index",
        embed_model: Optional[SentenceTransformer] = None
    ):
        """
        Initialize the vector database.
        
        Args:
            model_name: The embedding model to load from HuggingFace.
            index_path: Directory path and prefix where index files are saved.
            embed_model: Optional preloaded SentenceTransformer instance to avoid double loading.
        """
        # Normalize model name for backwards-compatibility
        if model_name == "all-MiniLM-L6-v2":
            model_name = "sentence-transformers/all-MiniLM-L6-v2"
            
        self.model_name = model_name
        self.index_path = index_path
        self.embed_model = embed_model if embed_model is not None else SentenceTransformer(model_name)
        self.index = None
        self.chunks: List[Dict[str, Any]] = []

        # Create output directories if needed
        os.makedirs(os.path.dirname(index_path), exist_ok=True)

        # Autoload if existing index files are present
        if os.path.exists(index_path + ".bin") and os.path.exists(index_path + ".pkl"):
            self.load_index()

    @property
    def metadata(self) -> List[str]:
        """Backwards compatibility property returning list of raw chunk texts."""
        return [c["text"] for c in self.chunks]

    def add_documents(self, documents: Union[List[str], List[Dict[str, Any]]]) -> None:
        """
        Encode and index a list of documents. Handles both metadata chunks and plain text lists.
        
        Args:
            documents: Either a list of dicts {"text": text, "metadata": metadata} or list of strings.
        """
        if not documents:
            return

        # Harmonize input documents to list of dicts (chunks)
        standardized_chunks = []
        for i, doc in enumerate(documents):
            if isinstance(doc, str):
                standardized_chunks.append({
                    "text": doc,
                    "metadata": {
                        "source_file": "unknown",
                        "chunk_index": len(self.chunks) + i,
                        "char_start": -1,
                        "char_end": -1,
                        "word_count": len(doc.split())
                    }
                })
            else:
                standardized_chunks.append(doc)

        texts = [chunk["text"] for chunk in standardized_chunks]
        embeddings = self.embed_model.encode(texts, show_progress_bar=False)
        
        # L2-normalize embeddings for Cosine Similarity search (using faiss Inner Product)
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        normalized_embeddings = embeddings / np.maximum(norms, 1e-12)
        
        dimension = normalized_embeddings.shape[1]
        
        if self.index is None:
            # IndexFlatIP calculates Cosine Similarity when L2 normalized
            self.index = faiss.IndexFlatIP(dimension)
            
        self.index.add(np.array(normalized_embeddings).astype("float32"))
        self.chunks.extend(standardized_chunks)
        self.save_index()

    def delete_source_file_chunks(self, source_file: str) -> None:
        """
        Remove all chunks associated with a specific source file and rebuild the index.
        This provides clean update behavior during ingestion instead of duplicating chunks.
        """
        if not self.chunks:
            return

        basename = os.path.basename(source_file)
        
        # Filter chunks that are not from this file
        remaining_chunks = []
        for chunk in self.chunks:
            chunk_file = chunk.get("metadata", {}).get("source_file", "")
            if chunk_file and os.path.basename(chunk_file) == basename:
                continue
            remaining_chunks.append(chunk)

        # If nothing was deleted, do nothing
        if len(remaining_chunks) == len(self.chunks):
            return

        logger.info(
            "Clearing %s existing chunks for %s from index.",
            len(self.chunks) - len(remaining_chunks),
            basename,
        )

        # Reset the index and rebuild
        self.chunks = []
        self.index = None
        
        # Re-add remaining documents
        if remaining_chunks:
            self.add_documents(remaining_chunks)
        else:
            # If no chunks left, clean up physical files
            for ext in (".bin", ".pkl"):
                full_path = self.index_path + ext
                if os.path.exists(full_path):
                    try:
                        os.remove(full_path)
                    except Exception as e:
                        logger.warning("Failed to remove stale FAISS file %s: %s", full_path, e)
            logger.info("Vector database is now completely empty.")

    def delete_document_chunks(self, document_id: str) -> None:
        """
        Remove all chunks associated with a specific document ID and rebuild the index.
        This provides clean delete behavior during document removal instead of leaving orphan chunks.
        """
        if not self.chunks:
            return

        # Filter chunks that are not from this document
        remaining_chunks = []
        for chunk in self.chunks:
            doc_id = chunk.get("metadata", {}).get("document_id")
            if doc_id and str(doc_id) == str(document_id):
                continue
            remaining_chunks.append(chunk)

        # If nothing was deleted, do nothing
        if len(remaining_chunks) == len(self.chunks):
            return

        logger.info(
            "Clearing %s existing chunks for document %s from index.",
            len(self.chunks) - len(remaining_chunks),
            document_id,
        )

        # Reset the index and rebuild
        self.chunks = []
        self.index = None
        
        # Re-add remaining documents
        if remaining_chunks:
            self.add_documents(remaining_chunks)
        else:
            # If no chunks left, clean up physical files
            for ext in (".bin", ".pkl"):
                full_path = self.index_path + ext
                if os.path.exists(full_path):
                    try:
                        os.remove(full_path)
                    except Exception as e:
                        logger.warning("Failed to remove stale FAISS file %s: %s", full_path, e)
            logger.info("Vector database is now completely empty.")

    def search(
        self, 
        query: str, 
        k: int = 3, 
        return_scores: bool = True,
        allowed_document_ids: Optional[List[str]] = None,
        allowed_scopes: Optional[List[str]] = None,
        min_score: Optional[float] = None,
    ) -> Union[List[Tuple[float, Dict[str, Any]]], List[str]]:
        """
        Retrieve closest documents, applying duplicate filtering and permission filters.
        Supports both V2 score/metadata retrieval and legacy string list.
        
        Args:
            query: The user query string.
            k: Number of closest items to retrieve.
            return_scores: If True, returns List[Tuple[float, Dict[str, Any]]] sorted descending (new V2 style).
                           If False, returns List[str] of raw texts (legacy style).
            allowed_document_ids: Optional list of document IDs the user is allowed to access.
            allowed_scopes: Optional list of scopes the user is allowed to access (e.g. ["system"]).
        """
        if self.index is None or not self.chunks:
            logger.warning("VectorDB index not loaded or empty.")
            return []

        # Encode and normalize query vector
        query_vector = self.embed_model.encode([query], show_progress_bar=False)
        q_norm = np.linalg.norm(query_vector, axis=1, keepdims=True)
        normalized_query = query_vector / np.maximum(q_norm, 1e-12)

        # Retrieve extra candidate search results to accommodate deduplication and permission filtering
        search_k = min(max(k * 5, 50), len(self.chunks))
        scores, indices = self.index.search(np.array(normalized_query).astype("float32"), search_k)

        results = []
        seen_texts = set()
        seen_chunks = set()

        for rank_idx, idx in enumerate(indices[0]):
            if idx == -1 or idx >= len(self.chunks):
                continue
            
            chunk = self.chunks[idx]
            meta = chunk.get("metadata", {})

            # Enforce RAG permission controls
            scope = meta.get("scope", "system")
            doc_id = meta.get("document_id")

            # Check if allowed
            is_allowed = False
            # If both allowed_document_ids and allowed_scopes are None (legacy or background system tasks), allow everything
            if allowed_document_ids is None and allowed_scopes is None:
                is_allowed = True
            else:
                if allowed_scopes is not None and scope in allowed_scopes:
                    is_allowed = True
                elif allowed_document_ids is not None and doc_id is not None and str(doc_id) in [str(x) for x in allowed_document_ids]:
                    is_allowed = True

            if not is_allowed:
                continue

            # Standardize text for strict text deduplication (normalize whitespace and casing)
            norm_text = " ".join(chunk["text"].lower().split())
            
            # Uniqueness key by file source and chunk index
            chunk_id = (meta.get("source_file"), meta.get("chunk_index"))
            
            if norm_text in seen_texts or chunk_id in seen_chunks:
                continue
                
            seen_texts.add(norm_text)
            seen_chunks.add(chunk_id)
            
            score = float(scores[0][rank_idx])
            if min_score is not None and score < min_score:
                continue
            results.append((score, chunk))
            
            if len(results) == k:
                break

        if return_scores:
            return results
        else:
            return [res[1]["text"] for res in results]

    def save_index(self) -> None:
        """Serialize index and chunks metadata to disk."""
        faiss.write_index(self.index, self.index_path + ".bin")
        with open(self.index_path + ".pkl", "wb") as f:
            pickle.dump(self.chunks, f)

    def load_index(self) -> None:
        """Load index and chunks metadata from disk."""
        self.index = faiss.read_index(self.index_path + ".bin")
        with open(self.index_path + ".pkl", "rb") as f:
            self.chunks = pickle.load(f)
        
        # Ensure backwards compatibility by defaulting scope to 'system'
        updated = False
        for chunk in self.chunks:
            if "metadata" not in chunk:
                chunk["metadata"] = {}
                updated = True
            if "scope" not in chunk["metadata"]:
                chunk["metadata"]["scope"] = "system"
                updated = True
        
        if updated:
            self.save_index()
            
        logger.info("VectorDB index loaded. Total indexed chunks: %s", len(self.chunks))