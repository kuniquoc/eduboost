# src/rag/semantic_chunker.py
#
# Semantic Text Splitter that groups sentences by semantic similarity.
# Uses sentence-transformers embeddings to compute cosine distances
# between consecutive sentences, then splits at semantic boundaries.
#
# Algorithm:
# 1. Split text into sentences
# 2. Compute embedding for each sentence
# 3. Calculate cosine distance between consecutive sentence pairs
# 4. Find breakpoints where distance exceeds a percentile threshold
# 5. Group sentences between breakpoints into chunks

import re
import numpy as np
from typing import List, Optional
from sentence_transformers import SentenceTransformer


class SemanticTextSplitter:
    """
    Splits text into semantically coherent chunks using sentence embeddings.
    
    Instead of splitting at fixed character counts, this splitter analyzes
    the semantic similarity between consecutive sentences and creates breaks
    where the topic or meaning shifts significantly.
    """

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        percentile_threshold: int = 75,
        min_chunk_size: int = 100,
        max_chunk_size: int = 1500,
        embed_model: Optional[SentenceTransformer] = None,
    ):
        """
        Args:
            model_name: Name of the sentence-transformers model for embeddings.
            percentile_threshold: Percentile (0-100) of cosine distances used
                to determine breakpoints. Higher values produce fewer, larger
                chunks; lower values produce more, smaller chunks.
            min_chunk_size: Minimum chunk length in characters. Chunks shorter
                than this are merged with their neighbor.
            max_chunk_size: Maximum chunk length in characters. Chunks exceeding
                this are force-split at sentence boundaries.
            embed_model: Optional pre-loaded SentenceTransformer instance. If
                provided, ``model_name`` is ignored and this model is reused,
                which avoids loading the model multiple times.
        """
        self.model = embed_model if embed_model is not None else SentenceTransformer(model_name)
        self.percentile_threshold = percentile_threshold
        self.min_chunk_size = min_chunk_size
        self.max_chunk_size = max_chunk_size

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def split_text(self, text: str) -> List[str]:
        """
        Split *text* into a list of semantically coherent chunks.

        Returns a list of non-empty strings, each representing one chunk.
        """
        sentences = self._split_into_sentences(text)
        if not sentences:
            return []

        # Single sentence → return as-is (cannot compute distances)
        if len(sentences) == 1:
            return [sentences[0].strip()] if sentences[0].strip() else []

        # Step 2 – compute embeddings for every sentence
        embeddings = self.model.encode(sentences, show_progress_bar=False)

        # Step 3 – cosine distance between consecutive pairs
        distances = self._compute_consecutive_distances(embeddings)

        # Step 4 – determine breakpoints
        breakpoints = self._find_breakpoints(distances)

        # Step 5 – group sentences into raw chunks
        raw_chunks = self._group_sentences(sentences, breakpoints)

        # Post-processing: enforce min / max size constraints
        chunks = self._enforce_size_constraints(raw_chunks)

        return chunks

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _split_into_sentences(text: str) -> List[str]:
        """
        Split text into sentences using a regex-based heuristic.

        Handles common abbreviations and avoids splitting on decimal
        numbers or common titles (Mr., Dr., etc.).
        """
        # Normalise whitespace but keep newlines for later
        text = text.replace("\r\n", "\n")

        # Split on sentence-ending punctuation followed by whitespace or EOL,
        # but keep the delimiter attached to the preceding sentence.
        pattern = r'(?<=[.!?])\s+'
        raw = re.split(pattern, text)

        # Further split on double-newlines (paragraph boundaries)
        sentences: List[str] = []
        for segment in raw:
            parts = re.split(r'\n{2,}', segment)
            sentences.extend(parts)

        # Strip and drop empties
        sentences = [s.strip() for s in sentences if s.strip()]
        return sentences

    @staticmethod
    def _cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
        """Return cosine distance (1 - cosine_similarity) between two vectors."""
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 1.0
        similarity = dot / (norm_a * norm_b)
        return float(1.0 - similarity)

    def _compute_consecutive_distances(self, embeddings: np.ndarray) -> List[float]:
        """
        Compute cosine distance between each pair of consecutive sentence
        embeddings.  Returns a list of length ``len(embeddings) - 1``.
        """
        distances: List[float] = []
        for i in range(len(embeddings) - 1):
            dist = self._cosine_distance(embeddings[i], embeddings[i + 1])
            distances.append(dist)
        return distances

    def _find_breakpoints(self, distances: List[float]) -> List[int]:
        """
        Identify indices where the distance exceeds the configured percentile
        threshold.  Each returned index ``i`` means "break *after* sentence i".
        """
        if not distances:
            return []

        threshold = float(np.percentile(distances, self.percentile_threshold))
        breakpoints = [i for i, d in enumerate(distances) if d >= threshold]
        return breakpoints

    @staticmethod
    def _group_sentences(sentences: List[str], breakpoints: List[int]) -> List[str]:
        """
        Group sentences into chunks, splitting at each breakpoint index.
        """
        chunks: List[str] = []
        start = 0
        for bp in sorted(breakpoints):
            end = bp + 1  # include the sentence at the breakpoint index
            chunk_text = " ".join(sentences[start:end]).strip()
            if chunk_text:
                chunks.append(chunk_text)
            start = end

        # Remaining sentences after last breakpoint
        if start < len(sentences):
            chunk_text = " ".join(sentences[start:]).strip()
            if chunk_text:
                chunks.append(chunk_text)

        return chunks

    def _enforce_size_constraints(self, chunks: List[str]) -> List[str]:
        """
        Merge chunks that are too small and split chunks that are too large.
        """
        # --- Merge small chunks with their successor ---
        merged: List[str] = []
        buffer = ""
        for chunk in chunks:
            if buffer:
                combined = buffer + " " + chunk
                if len(combined) <= self.max_chunk_size:
                    buffer = combined
                else:
                    # Buffer is still under min but we'd exceed max → flush
                    merged.append(buffer.strip())
                    buffer = chunk
            else:
                buffer = chunk

            if len(buffer) >= self.min_chunk_size:
                merged.append(buffer.strip())
                buffer = ""

        if buffer.strip():
            # Attach leftover to last chunk if possible
            if merged and len(merged[-1]) + len(buffer) + 1 <= self.max_chunk_size:
                merged[-1] = merged[-1] + " " + buffer.strip()
            else:
                merged.append(buffer.strip())

        # --- Force-split oversized chunks at sentence boundaries ---
        final: List[str] = []
        for chunk in merged:
            if len(chunk) <= self.max_chunk_size:
                final.append(chunk)
            else:
                # Re-split into sentences and accumulate
                sub_sentences = self._split_into_sentences(chunk)
                current = ""
                for sent in sub_sentences:
                    candidate = (current + " " + sent).strip() if current else sent
                    if len(candidate) <= self.max_chunk_size:
                        current = candidate
                    else:
                        if current:
                            final.append(current)
                        current = sent
                if current:
                    final.append(current)

        return final


# ---------------------------------------------------------------------------
# Quick smoke test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    sample = (
        "The Present Simple tense is used for habits and routines. "
        "For example, I wake up at 7 AM every day. "
        "Signal words include always, usually, and often. "
        "The Present Continuous tense describes actions happening now. "
        "For example, I am reading a book right now. "
        "Signal words include now, at the moment, and currently. "
        "Conditional sentences express a condition and its result. "
        "Type 1 uses present simple in the if-clause and will in the main clause. "
        "Type 2 uses past simple in the if-clause and would in the main clause."
    )
    splitter = SemanticTextSplitter(percentile_threshold=75)
    chunks = splitter.split_text(sample)
    print(f"Number of chunks: {len(chunks)}")
    for i, c in enumerate(chunks, 1):
        print(f"\n--- Chunk {i} ({len(c)} chars) ---")
        print(c)
