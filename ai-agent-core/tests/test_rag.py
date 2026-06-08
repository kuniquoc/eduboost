import os
import shutil
import tempfile
import unittest
from typing import List, Dict, Any

from src.rag.document_reader import DocumentReader
from src.rag.text_splitters import SlidingWindowTextSplitter, SemanticTextSplitter
from src.rag.vector_db import VectorDB
from src.rag.pipeline import RAGPipeline

class TestRAGComponents(unittest.TestCase):
    def setUp(self):
        # Create a temp directory for any test artifacts
        self.test_dir = tempfile.mkdtemp()
        
        # Paths for testing index saving
        self.db_path = os.path.join(self.test_dir, "test_vector_db")

    def tearDown(self):
        # Clean up the temp directory
        shutil.rmtree(self.test_dir)

    def test_document_reader_txt(self):
        """Test that DocumentReader correctly reads a standard TXT file."""
        reader = DocumentReader()
        
        # Create a temporary txt file
        txt_path = os.path.join(self.test_dir, "sample.txt")
        sample_content = "This is a simple TXT file content for testing DocumentReader.\nLine 2 content."
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(sample_content)
            
        content = reader.load_document(txt_path)
        self.assertEqual(content, sample_content)

    def test_sliding_window_splitter(self):
        """Test that SlidingWindowTextSplitter splits correctly into standardized chunk dicts."""
        splitter = SlidingWindowTextSplitter(chunk_size=5, chunk_overlap=2)
        sample_text = "One two three four five six seven eight nine ten."
        
        chunks = splitter.split_text(sample_text, source_file="test.txt")
        
        self.assertGreater(len(chunks), 0)
        # Check first chunk structure
        first_chunk = chunks[0]
        self.assertIn("text", first_chunk)
        self.assertIn("metadata", first_chunk)
        
        metadata = first_chunk["metadata"]
        self.assertEqual(metadata["source_file"], "test.txt")
        self.assertEqual(metadata["chunk_index"], 0)
        self.assertGreater(metadata["word_count"], 0)
        self.assertEqual(metadata["char_start"], 0)
        
        # Verify text slicing is correct
        self.assertEqual(sample_text[metadata["char_start"]:metadata["char_end"]], first_chunk["text"])

    def test_semantic_splitter(self):
        """Test that SemanticTextSplitter inherits BaseTextSplitter and returns standardised chunks."""
        # Using simple local embed_model mock or actual one. Since all-MiniLM-L6-v2 is fast, 
        # let's initialize it. (Or let's mock it if speed is crucial, but running it is fine since it's already cached)
        splitter = SemanticTextSplitter(percentile_threshold=50)
        
        sample_text = (
            "The Present Simple tense is used for habits. "
            "For example, I walk every morning. "
            "The Present Continuous is for actions happening right now. "
            "For example, I am walking currently."
        )
        
        chunks = splitter.split_text(sample_text, source_file="grammar.txt")
        
        self.assertGreater(len(chunks), 0)
        for i, chunk in enumerate(chunks):
            self.assertIn("text", chunk)
            self.assertIn("metadata", chunk)
            
            meta = chunk["metadata"]
            self.assertEqual(meta["source_file"], "grammar.txt")
            self.assertEqual(meta["chunk_index"], i)
            self.assertGreater(meta["word_count"], 0)
            
            # Ensure character positions match the text slice perfectly
            if meta["char_start"] != -1:
                self.assertEqual(
                    sample_text[meta["char_start"]:meta["char_end"]], 
                    chunk["text"]
                )

    def test_vector_db_advanced_metadata(self):
        """Test VectorDB V2 metadata chunk support and Cosine Similarity search."""
        db = VectorDB(index_path=self.db_path)
        
        test_chunks = [
            {"text": "Python is a dynamic programming language.", "metadata": {"source_file": "python.txt", "chunk_index": 0}},
            {"text": "FastAPI is a modern web framework for Python.", "metadata": {"source_file": "fastapi.txt", "chunk_index": 1}},
            {"text": "FAISS provides fast nearest-neighbor vector search.", "metadata": {"source_file": "faiss.txt", "chunk_index": 2}}
        ]
        
        db.add_documents(test_chunks)
        
        # Test standard search (V2 behavior: score, chunk_dict)
        results = db.search("fast searching in vector database", k=2, return_scores=True)
        
        self.assertEqual(len(results), 2)
        score, chunk = results[0]
        self.assertIsInstance(score, float)
        self.assertIn("text", chunk)
        self.assertIn("metadata", chunk)
        
        # Ensure FAISS has correct total items
        self.assertEqual(len(db.chunks), 3)

    def test_vector_db_backwards_compatibility(self):
        """Test that VectorDB dynamically handles legacy string lists and returns legacy plain list of strings."""
        db = VectorDB(index_path=self.db_path)
        
        legacy_texts = [
            "We have simple sentence one.",
            "This is simple sentence two.",
            "Yet another simple sentence three."
        ]
        
        # Add legacy string list
        db.add_documents(legacy_texts)
        
        # Verify metadata property works for legacy checks
        self.assertEqual(len(db.metadata), 3)
        self.assertEqual(db.metadata[0], legacy_texts[0])
        
        # Test search with return_scores=False (legacy behavior)
        results = db.search("simple sentence", k=2, return_scores=False)
        
        self.assertEqual(len(results), 2)
        self.assertIsInstance(results[0], str)
        self.assertIn(results[0], legacy_texts)

    def test_rag_pipeline_integration(self):
        """Test full pipeline loading, indexing, and query trace logs."""
        pipeline = RAGPipeline(index_path=self.db_path, log_file_path=os.path.join(self.test_dir, "trace.log"))
        
        # Create temporary raw content file
        doc_path = os.path.join(self.test_dir, "temp_data.txt")
        with open(doc_path, "w", encoding="utf-8") as f:
            f.write(
                "EduBoost tutoring system supports adaptive learning. "
                "It combines Bayesian Knowledge Tracing and Item Response Theory. "
                "Socratic explanations are generated using textbook contexts."
            )
            
        pipeline.ingest_file(doc_path)
        
        # Verify query runs smoothly (using mock/live LLM generator fallback)
        res = pipeline.query("What theories does EduBoost combine?")
        
        self.assertIn("query", res)
        self.assertIn("answer", res)
        self.assertGreater(res["bi_candidates_count"], 0)
        self.assertGreater(res["reranked_candidates_count"], 0)
        self.assertEqual(len(res["top_3_contexts"]), min(pipeline.top_k, res["reranked_candidates_count"]))
        
        # Verify trace log file was created
        self.assertTrue(os.path.exists(pipeline.log_file_path))

    def test_vector_db_delete_and_permissions(self):
        """Test VectorDB document deletion and dynamic metadata permission filtering."""
        db = VectorDB(index_path=self.db_path)
        
        test_chunks = [
            {
                "text": "This is a system textbook document.",
                "metadata": {"source_file": "textbook.txt", "chunk_index": 0, "scope": "system"}
            },
            {
                "text": "This is student Alice private document.",
                "metadata": {"source_file": "alice.txt", "chunk_index": 0, "scope": "student", "document_id": "doc-alice-123"}
            },
            {
                "text": "This is student Bob private document.",
                "metadata": {"source_file": "bob.txt", "chunk_index": 0, "scope": "student", "document_id": "doc-bob-456"}
            }
        ]
        
        db.add_documents(test_chunks)
        self.assertEqual(len(db.chunks), 3)

        # 1. Search with no filter (should return everything matching query)
        results = db.search("document", k=3, return_scores=False)
        self.assertEqual(len(results), 3)

        # 2. Search filtered by allowed_scopes=["system"]
        results_system = db.search("document", k=3, return_scores=False, allowed_scopes=["system"], allowed_document_ids=[])
        self.assertEqual(len(results_system), 1)
        self.assertIn("This is a system textbook document.", results_system)

        # 3. Search filtered by Alice's allowed document IDs
        results_alice = db.search("document", k=3, return_scores=False, allowed_scopes=["system"], allowed_document_ids=["doc-alice-123"])
        self.assertEqual(len(results_alice), 2)
        self.assertIn("This is student Alice private document.", results_alice)
        self.assertNotIn("This is student Bob private document.", results_alice)

        # 4. Delete Alice's document
        db.delete_document_chunks("doc-alice-123")
        self.assertEqual(len(db.chunks), 2)

        # 5. Search again with Alice's permissions (Alice doc should be gone)
        results_alice_post_delete = db.search("document", k=3, return_scores=False, allowed_scopes=["system"], allowed_document_ids=["doc-alice-123"])
        self.assertEqual(len(results_alice_post_delete), 1)
        self.assertNotIn("This is student Alice private document.", results_alice_post_delete)

if __name__ == "__main__":
    unittest.main()
