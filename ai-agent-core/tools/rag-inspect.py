# src/eduboost_agent/rag/test_pipeline.py

import os
import sys
import logging

# Ensure project root is in the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from eduboost_agent.rag.pipeline import RAGPipeline

def run_test():
    # Setup logger config for verification
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    )

    print("\n" + "=" * 60)
    print("           RAG PIPELINE INTEGRATION TEST           ")
    print("=" * 60)

    # Wipe any pre-existing test FAISS files for a clean test run
    test_index_path = "models/test_vector_db_v2/faiss_index"
    for ext in (".bin", ".pkl"):
        full_path = test_index_path + ext
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except Exception:
                pass

    # Initialize RAG Pipeline
    # Using specific index and log paths for testing
    pipeline = RAGPipeline(
        index_path=test_index_path,
        log_file_path="rag_trace.log"
    )

    # Ingest test dataset
    raw_data_dir = "data/raw"
    if os.path.exists(raw_data_dir):
        print(f"\n[INFO] Scanning and ingesting raw documents from '{raw_data_dir}'...")
        pipeline.ingest_directory(raw_data_dir)
        
        # Double ingestion test: Ingesting the directory again should clear previous and leave chunk count identical
        initial_chunk_count = len(pipeline.vector_db.chunks)
        print(f"\n[INFO] Re-ingesting raw documents to verify deduplication mechanism. Initial chunk count: {initial_chunk_count}...")
        pipeline.ingest_directory(raw_data_dir)
        final_chunk_count = len(pipeline.vector_db.chunks)
        print(f"[INFO] Ingestion complete. Final chunk count: {final_chunk_count}")
        assert initial_chunk_count == final_chunk_count, f"Deduplication failed: initial count ({initial_chunk_count}) != final count ({final_chunk_count})"
        print("[SUCCESS] Double-ingestion verification successful! Chunk counts remain perfectly identical.")
    else:
        # Fallback inline creation for standalone safety
        print(f"\n[WARNING] '{raw_data_dir}' directory not found. Creating a temporary test file.")
        os.makedirs(raw_data_dir, exist_ok=True)
        temp_file_path = os.path.join(raw_data_dir, "test_conditional_sentences.txt")
        with open(temp_file_path, "w", encoding="utf-8") as f:
            f.write(
                "Conditional sentences type 1 are used to express real or possible situations. "
                "The structure is: If + Present Simple, Will + Verb. "
                "For example: If it rains, we will stay at home. "
                "This condition is highly likely to happen in the present or future.\n\n"
                "Conditional sentences type 2 are used to express imaginary or impossible situations. "
                "The structure is: If + Past Simple, Would + Verb. "
                "For example: If I won the lottery, I would buy a big house. "
                "This is a hypothetical condition that is unlikely to occur."
            )
        pipeline.ingest_file(temp_file_path)

    # Run sample queries
    test_queries = [
        "Explain the difference between Present Simple and Present Continuous."
    ]

    print("\n" + "=" * 60)
    print("               EXECUTING TEST QUERIES              ")
    print("=" * 60)

    for query in test_queries:
        print(f"\n>>> Running Query: \"{query}\"\n")
        pipeline.query(query)

    print("\n" + "=" * 60)
    print("               TEST COMPLETE SUCCESS               ")
    print("=" * 60)
    print("Check the terminal output above for colored logs and")
    print("verify the file 'rag_trace.log' for the full plain text trace.")

if __name__ == "__main__":
    run_test()
