# src/rag/pipeline.py

import os
import logging
from typing import List, Dict, Any

from src.rag.document_reader import DocumentReader
from src.rag.text_splitters import SemanticTextSplitter, SlidingWindowTextSplitter
from src.rag.vector_db import VectorDB
from src.rag.reranker import CrossEncoderReranker
from src.rag.llm_generator import LLMGenerator

# Configure python standard logging
logger = logging.getLogger(__name__)

# ANSI Color Codes for premium console formatting
C_RESET = "\033[0m"
C_GOLD = "\033[38;5;220m"
C_CYAN = "\033[36m"
C_GREEN = "\033[32m"
C_WHITE = "\033[37m"
C_GRAY = "\033[90m"
C_BOLD = "\033[1m"

class RAGPipeline:
    """Orchestrates the entire RAG pipeline from ingestion to multi-stage retrieval, reranking, and generation."""

    def __init__(
        self,
        index_path: str = "models/vector_db_v2/faiss_index",
        log_file_path: str = "rag_trace.log",
        top_k: int = 5
    ):
        self.log_file_path = log_file_path
        self.top_k = top_k
        
        logger.info("Initializing RAG Pipeline components...")
        self.reader = DocumentReader()
        self.vector_db = VectorDB(index_path=index_path)
        
        # Standardize on SemanticTextSplitter, sharing the vector_db embedding model to save memory
        # percentile_threshold is slightly lowered to 70 and max_chunk_size is set to 2000 to keep sections complete.
        self.splitter = SemanticTextSplitter(
            embed_model=self.vector_db.embed_model,
            percentile_threshold=70,
            min_chunk_size=100,
            max_chunk_size=2000
        )
        
        self.reranker = CrossEncoderReranker()
        self.generator = LLMGenerator()
        logger.info("RAG Pipeline initialized successfully.")

    # ------------------------------------------------------------------
    # Ingestion API
    # ------------------------------------------------------------------

    def ingest_file(self, file_path: str) -> None:
        """Load, chunk, and index a single document."""
        logger.info("Ingesting file: %s", file_path)
        text = self.reader.load_document(file_path)
        if not text.strip():
            logger.warning("No content extracted from %s.", file_path)
            return

        chunks = self.splitter.split_text(text, file_path)
        logger.info("Extracted %d chunks from %s.", len(chunks), os.path.basename(file_path))
        
        # Deduplicate: Remove pre-existing chunks from the same file to prevent duplicates
        self.vector_db.delete_source_file_chunks(file_path)
        
        self.vector_db.add_documents(chunks)
        logger.info("Successfully indexed %s.", os.path.basename(file_path))

    def ingest_directory(self, directory_path: str) -> None:
        """Scan a directory and index all supported documents (txt, pdf, docx)."""
        if not os.path.exists(directory_path):
            logger.error("Ingestion directory does not exist: %s", directory_path)
            return

        supported_exts = (".txt", ".pdf", ".docx")
        logger.info("Scanning directory for ingestion: %s", directory_path)
        
        for filename in sorted(os.listdir(directory_path)):
            file_path = os.path.join(directory_path, filename)
            if os.path.isfile(file_path) and os.path.splitext(filename)[1].lower() in supported_exts:
                self.ingest_file(file_path)

    # ------------------------------------------------------------------
    # Retrieval & Reranking Core
    # ------------------------------------------------------------------

    def query(self, user_query: str) -> Dict[str, Any]:
        """
        Execute the full Bi-Encoder + Cross-Encoder Reranking RAG process.
        
        Follows this flow:
        1. Embed and search Top-20 candidates using VectorDBV2 (Bi-Encoder).
        2. Rerank candidate chunks using Cross-Encoder.
        3. Extract Top-k reranked chunks.
        4. Generate final answer with LLM using the selected Top-k contexts.
        5. Write detailed logs to stdout (colored) and rag_trace.log (plain text).
        """
        # Step 1: Bi-Encoder Retrieval (Top 20)
        bi_candidates = self.vector_db.search(user_query, k=20)
        
        # Step 2: Cross-Encoder Reranking
        raw_chunks = [cand[1] for cand in bi_candidates]
        reranked_results = self.reranker.rerank(user_query, raw_chunks)
        
        # Step 3: Select Top K
        selected_results = reranked_results[:self.top_k]
        selected_contexts = [res[1]["text"] for res in selected_results]
        
        # Step 4: Generate LLM Answer
        answer = self.generator.generate_answer(user_query, selected_contexts)
        
        # Construct Trace Logs (Plain text for file, Colored for Console)
        trace_plain = self._build_trace(user_query, bi_candidates, reranked_results, selected_results, answer, colored=False)
        trace_color = self._build_trace(user_query, bi_candidates, reranked_results, selected_results, answer, colored=True)
        
        # Output trace
        self._write_to_trace_log(trace_plain)
        print(trace_color)
        
        return {
            "query": user_query,
            "bi_candidates_count": len(bi_candidates),
            "reranked_candidates_count": len(reranked_results),
            "top_k_contexts": selected_results,
            "top_3_contexts": selected_results,  # Alias for strict backwards compatibility
            "answer": answer
        }

    # ------------------------------------------------------------------
    # Logging Trace Builders
    # ------------------------------------------------------------------

    def _build_trace(
        self,
        query: str,
        bi_candidates: List[tuple],
        reranked_results: List[tuple],
        selected_results: List[tuple],
        answer: str,
        colored: bool = False
    ) -> str:
        """Format the RAG Trace according to the exact layout specifications."""
        # Color helper variables
        gold = C_GOLD if colored else ""
        cyan = C_CYAN if colored else ""
        green = C_GREEN if colored else ""
        white = C_WHITE if colored else ""
        gray = C_GRAY if colored else ""
        bold = C_BOLD if colored else ""
        reset = C_RESET if colored else ""

        lines = []
        lines.append(f"{gold}================== RAG TRACE =================={reset}")
        lines.append(f"{bold}[QUERY]{reset} \"{query}\"\n")
        
        # Step 1: Bi-Encoder Retrieval
        lines.append(f"{cyan}[STEP 1 - BI-ENCODER RETRIEVAL]{reset} Top-20 candidates:")
        for rank_idx, (score, chunk) in enumerate(bi_candidates, 1):
            chunk_meta = chunk["metadata"]
            src_file = chunk_meta.get("source_file", "unknown")
            chunk_num = chunk_meta.get("chunk_index", -1)
            
            # Clean and truncate text for single line preview
            text_preview = " ".join(chunk["text"].split())[:80]
            if len(chunk["text"]) > 80:
                text_preview += "..."
                
            rank_str = f"{rank_idx:02d}"
            lines.append(
                f"  Rank {rank_str} | {green}Score: {score:.4f}{reset} | "
                f"Chunk #{chunk_num} ({gray}{src_file}{reset}) | \"{white}{text_preview}{reset}\""
            )
        lines.append("")
        
        # Step 2: Cross-Encoder Reranking
        lines.append(f"{cyan}[STEP 2 - CROSS-ENCODER RERANKING]{reset} Scores:")
        for rerank_score, chunk in reranked_results:
            chunk_meta = chunk["metadata"]
            chunk_num = chunk_meta.get("chunk_index", -1)
            src_file = chunk_meta.get("source_file", "unknown")
            lines.append(
                f"  Chunk #{chunk_num} ({gray}{src_file}{reset}) → "
                f"{green}rerank_score: {rerank_score:.2f}{reset}"
            )
        lines.append("")
        
        # Step 3: Top-K Selected
        lines.append(f"{cyan}[STEP 3 - TOP-{len(selected_results)} SELECTED]{reset}")
        for idx, (rerank_score, chunk) in enumerate(selected_results, 1):
            chunk_meta = chunk["metadata"]
            chunk_num = chunk_meta.get("chunk_index", -1)
            src_file = chunk_meta.get("source_file", "unknown")
            
            # Indent each line of the full chunk text by 6 spaces for premium console readability
            indented_text = "\n".join("      " + line for line in chunk["text"].split("\n"))
            
            lines.append(
                f"  #{idx} Chunk #{chunk_num} ({gray}{src_file}{reset}) | "
                f"{green}rerank: {rerank_score:.2f}{reset}\n"
                f"    {white}Text Content:{reset}\n{white}{indented_text}{reset}"
            )
        lines.append("")
        
        # Step 4: LLM Answer
        lines.append(f"{cyan}[STEP 4 - LLM ANSWER]{reset}")
        lines.append(f"  \"{white}{answer}{reset}\"")
        lines.append(f"{gold}==============================================={reset}")
        
        return "\n".join(lines)

    def _write_to_trace_log(self, content: str) -> None:
        """Append plain text log entries to the rag_trace.log file."""
        try:
            with open(self.log_file_path, "a", encoding="utf-8") as f:
                f.write(content + "\n\n")
        except Exception as e:
            logger.error("Failed to write to RAG trace log file: %s", e)
