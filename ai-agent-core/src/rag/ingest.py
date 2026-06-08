# src/rag/ingest.py
#
# RAG Ingestor — reads PDF and TXT files, splits them into semantically
# coherent chunks using SemanticTextSplitter, and stores the chunks in
# the FAISS-backed VectorDB.

import os
import sys

# Ensure project root is in the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from src.rag.document_reader import DocumentReader
from src.rag.text_splitters import SemanticTextSplitter
from src.rag.vector_db import VectorDB


class RAGIngestor:
    """Reads documents, chunks them semantically, and ingests into VectorDB."""

    def __init__(self, vector_db: VectorDB):
        self.db = vector_db
        self.reader = DocumentReader()
        # Re-use the same embedding model the VectorDB already loaded so we
        # don't waste memory loading it twice.
        self.text_splitter = SemanticTextSplitter(
            embed_model=vector_db.embed_model,
            percentile_threshold=75,
            min_chunk_size=100,
            max_chunk_size=1500,
        )

    def process_file(self, file_path: str) -> None:
        """Extract, chunk, and ingest a single file."""
        print(f"Loading and extracting file: {file_path}...")
        full_text = self.reader.load_document(file_path)

        if not full_text.strip():
            print(f"No content found in {file_path}. Skipping.")
            return

        # Semantic chunking
        chunks = self.text_splitter.split_text(full_text, source_file=file_path)
        print(f"Split {os.path.basename(file_path)} into {len(chunks)} semantic chunks.")

        # Ensure default scope is 'system'
        for chunk in chunks:
            if "metadata" not in chunk:
                chunk["metadata"] = {}
            chunk["metadata"]["scope"] = "system"

        # Store in VectorDB
        self.db.add_documents(chunks)
        print(f"Successfully ingested {file_path}.")

    def ingest_text_with_metadata(self, text: str, source_file: str, metadata: dict) -> int:
        """Split text and ingest into VectorDB with custom metadata fields."""
        chunks = self.text_splitter.split_text(text, source_file=source_file)
        
        # Merge custom metadata fields into each chunk's metadata
        for chunk in chunks:
            if "metadata" not in chunk:
                chunk["metadata"] = {}
            chunk["metadata"].update(metadata)
            
        self.db.add_documents(chunks)
        return len(chunks)

    def process_directory(self, directory_path: str) -> None:
        """Scan a directory and ingest all supported files."""
        if not os.path.exists(directory_path):
            print(f"Directory {directory_path} not found.")
            return

        print(f"Scanning directory: {directory_path}...")
        supported = (".pdf", ".txt")
        for filename in sorted(os.listdir(directory_path)):
            file_path = os.path.join(directory_path, filename)
            if os.path.isfile(file_path) and os.path.splitext(filename)[1].lower() in supported:
                self.process_file(file_path)


if __name__ == "__main__":
    # Default data directory; can be overridden via CLI argument
    data_dir = sys.argv[1] if len(sys.argv) > 1 else "data/raw/"

    print("=" * 60)
    print("EduBoost RAG Ingestor — Semantic Chunking")
    print("=" * 60)

    db = VectorDB()
    ingestor = RAGIngestor(db)
    ingestor.process_directory(data_dir)

    print("=" * 60)
    total = len(db.chunks)
    print(f"Ingestion complete. Total chunks in VectorDB: {total}")
    print("=" * 60)