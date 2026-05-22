# src/rag/ingest.py
#
# RAG Ingestor — reads PDF and TXT files, splits them into semantically
# coherent chunks using SemanticTextSplitter, and stores the chunks in
# the FAISS-backed VectorDB.

import os
import sys

from PyPDF2 import PdfReader
from src.rag.semantic_chunker import SemanticTextSplitter
from src.rag.vector_db import VectorDB


class RAGIngestor:
    """Reads documents, chunks them semantically, and ingests into VectorDB."""

    def __init__(self, vector_db: VectorDB):
        self.db = vector_db
        # Re-use the same embedding model the VectorDB already loaded so we
        # don't waste memory loading it twice.
        self.text_splitter = SemanticTextSplitter(
            embed_model=vector_db.embed_model,
            percentile_threshold=75,
            min_chunk_size=100,
            max_chunk_size=1500,
        )

    # ------------------------------------------------------------------
    # File extraction helpers
    # ------------------------------------------------------------------

    def _extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text from a PDF file."""
        print(f"Extracting PDF: {pdf_path}...")
        text = ""
        try:
            reader = PdfReader(pdf_path)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        except Exception as e:
            print(f"Error reading PDF {pdf_path}: {e}")
        return text

    def _extract_text_from_txt(self, txt_path: str) -> str:
        """Extract text from a TXT file with encoding fallback."""
        print(f"Extracting TXT: {txt_path}...")
        try:
            with open(txt_path, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            with open(txt_path, "r", encoding="latin-1") as f:
                return f.read()
        except Exception as e:
            print(f"Error reading TXT {txt_path}: {e}")
            return ""

    # ------------------------------------------------------------------
    # Processing
    # ------------------------------------------------------------------

    def process_file(self, file_path: str) -> None:
        """Extract, chunk, and ingest a single file."""
        ext = os.path.splitext(file_path)[1].lower()

        if ext == ".pdf":
            full_text = self._extract_text_from_pdf(file_path)
        elif ext == ".txt":
            full_text = self._extract_text_from_txt(file_path)
        else:
            print(f"Unsupported format {ext}: {file_path}")
            return

        if not full_text.strip():
            print(f"No content found in {file_path}. Skipping.")
            return

        # Semantic chunking
        chunks = self.text_splitter.split_text(full_text)
        print(f"Split {os.path.basename(file_path)} into {len(chunks)} semantic chunks.")

        # Store in VectorDB
        self.db.add_documents(chunks)
        print(f"Successfully ingested {file_path}.")

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
    total = len(db.metadata)
    print(f"Ingestion complete. Total chunks in VectorDB: {total}")
    print("=" * 60)