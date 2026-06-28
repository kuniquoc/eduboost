# src/eduboost_agent/rag/reranker.py

import logging
from typing import List, Dict, Any, Tuple
from sentence_transformers import CrossEncoder

logger = logging.getLogger(__name__)

class CrossEncoderReranker:
    """Reranks candidate chunks using a local Cross-Encoder model."""

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        """
        Initialize the Cross-Encoder.
        
        Args:
            model_name: HuggingFace model ID for the Cross-Encoder.
        """
        self.model_name = model_name
        logger.info("Loading Cross-Encoder model: %s...", model_name)
        self.model = CrossEncoder(model_name)

    def rerank(self, query: str, candidates: List[Dict[str, Any]]) -> List[Tuple[float, Dict[str, Any]]]:
        """
        Compute reranking scores for candidate chunks against a query.
        
        Args:
            query: The user query string.
            candidates: A list of chunk dicts {"text": text, "metadata": metadata}.
            
        Returns:
            A list of tuples (rerank_score, chunk_dict) sorted by score descending.
        """
        if not candidates:
            return []

        # Prepare pairs for the Cross-Encoder: (query, text)
        pairs = [(query, chunk["text"]) for chunk in candidates]
        
        # Predict scores
        logger.info("Computing rerank scores for %d candidates...", len(candidates))
        scores = self.model.predict(pairs)
        
        # Combine scores and chunks
        scored_candidates = []
        for idx, score in enumerate(scores):
            # Score can be cast to native float for JSON-serialization safety
            scored_candidates.append((float(score), candidates[idx]))
            
        # Sort in descending order of rerank score
        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        
        return scored_candidates


if __name__ == "__main__":
    # Small test suite to check functionality
    logging.basicConfig(level=logging.INFO)
    reranker = CrossEncoderReranker()
    test_query = "What is Python?"
    test_candidates = [
        {"text": "Java is a class-based, object-oriented programming language.", "metadata": {}},
        {"text": "Python is an interpreted, high-level, general-purpose programming language.", "metadata": {}},
        {"text": "FAISS is a library for efficient similarity search of dense vectors.", "metadata": {}}
    ]
    results = reranker.rerank(test_query, test_candidates)
    print("\nReranking results:")
    for score, chunk in results:
        print(f"Rerank Score: {score:6.2f} | Text: {chunk['text']}")
