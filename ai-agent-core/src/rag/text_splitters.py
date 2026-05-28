# src/rag/text_splitters.py

import os
import re
import numpy as np
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer

class BaseTextSplitter(ABC):
    """
    Abstract base class for all text splitters.
    Defines a unified interface for dividing text into standardized chunks.
    """

    @abstractmethod
    def split_text(self, text: str, source_file: str = "unknown") -> List[Dict[str, Any]]:
        """
        Split a string of text into a list of standardized chunks with metadata.
        
        Args:
            text: The raw input string content.
            source_file: The name of the file being split, for metadata tracking.
            
        Returns:
            A list of dicts: {"text": chunk_text, "metadata": metadata_dict}
        """
        pass


class SlidingWindowTextSplitter(BaseTextSplitter):
    """
    Splits text into overlapping chunks using a sliding window.
    Uses word bounds to capture exact character positions.
    """

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50):
        """
        Args:
            chunk_size: Maximum number of words in a chunk.
            chunk_overlap: Number of overlapping words between consecutive chunks.
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str, source_file: str = "unknown") -> List[Dict[str, Any]]:
        if not text.strip():
            return []

        # Find all words and their character spans
        word_spans = []
        for match in re.finditer(r'\S+', text):
            word_spans.append({
                "word": match.group(),
                "start": match.start(),
                "end": match.end()
            })

        total_words = len(word_spans)
        if total_words == 0:
            return []

        chunks = []
        chunk_idx = 0
        
        step_size = self.chunk_size - self.chunk_overlap
        if step_size <= 0:
            step_size = self.chunk_size  # Safe fallback if overlap is >= chunk_size

        start_word_idx = 0
        while start_word_idx < total_words:
            # End index of words in current chunk
            end_word_idx = min(start_word_idx + self.chunk_size - 1, total_words - 1)
            
            # Retrieve exact character bounds
            char_start = word_spans[start_word_idx]["start"]
            char_end = word_spans[end_word_idx]["end"]
            
            # Slice text using absolute indices to preserve original formatting
            chunk_content = text[char_start:char_end]
            word_count = end_word_idx - start_word_idx + 1
            
            metadata = {
                "source_file": os.path.basename(source_file),
                "chunk_index": chunk_idx,
                "char_start": char_start,
                "char_end": char_end,
                "word_count": word_count
            }
            
            chunks.append({
                "text": chunk_content,
                "metadata": metadata
            })
            
            chunk_idx += 1
            
            # If we've reached the end of the file, terminate
            if end_word_idx == total_words - 1:
                break
                
            # Slide window forward
            start_word_idx += step_size

        return chunks


class SemanticTextSplitter(BaseTextSplitter):
    """
    Splits text into semantically coherent chunks using sentence embeddings.
    Creates breaks where the topic or meaning shifts significantly.
    """

    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        percentile_threshold: int = 75,
        min_chunk_size: int = 100,
        max_chunk_size: int = 1500,
        embed_model: Optional[SentenceTransformer] = None,
    ):
        """
        Args:
            model_name: Name of the sentence-transformers model.
            percentile_threshold: Percentile of cosine distances used to determine breakpoints.
            min_chunk_size: Minimum chunk length in characters.
            max_chunk_size: Maximum chunk length in characters.
            embed_model: Optional preloaded SentenceTransformer instance to avoid double loading.
        """
        # Backwards compatibility: if model_name is simple 'all-MiniLM-L6-v2', map to huggingface ID
        if model_name == "all-MiniLM-L6-v2":
            model_name = "sentence-transformers/all-MiniLM-L6-v2"
            
        self.model = embed_model if embed_model is not None else SentenceTransformer(model_name)
        self.percentile_threshold = percentile_threshold
        self.min_chunk_size = min_chunk_size
        self.max_chunk_size = max_chunk_size

    def _find_active_headers(self, text: str, char_start: int) -> tuple:
        """Look backward in text from char_start to find the most recent chapter and section headers."""
        if char_start <= 0:
            return "", ""
            
        text_before = text[:char_start]
        lines = text_before.split("\n")
        
        chapter = ""
        section = ""
        
        # Iterate backwards through lines
        for line in reversed(lines):
            line_strip = line.strip()
            if not line_strip:
                continue
                
            # Match chapters: e.g., "CHAPTER 3: FIRST CONDITIONAL (TYPE 1)"
            if re.match(r"^CHAPTER\s+\d+", line_strip, re.IGNORECASE):
                if not chapter:
                    chapter = line_strip
            # Match section headings: e.g., "3.1 Form" or "3.2 Usage"
            elif re.match(r"^\d+\.\d+\s+[A-Za-z]", line_strip) or re.match(r"^\d+\.\d+\s+\w+", line_strip):
                if not section:
                    section = line_strip
                    
            if chapter and section:
                break
                
        return chapter, section

    def split_text(self, text: str, source_file: str = "unknown") -> List[Dict[str, Any]]:
        sentences = self._split_into_sentences(text)
        if not sentences:
            return []

        # Single sentence -> return as-is
        if len(sentences) == 1:
            chunk_strings = [sentences[0].strip()] if sentences[0].strip() else []
        else:
            # Step 2 – compute embeddings
            embeddings = self.model.encode(sentences, show_progress_bar=False)

            # Step 3 – cosine distance
            distances = self._compute_consecutive_distances(embeddings)

            # Step 4 – determine breakpoints
            breakpoints = self._find_breakpoints(distances)

            # Step 5 – group sentences
            raw_chunks = self._group_sentences(sentences, breakpoints)

            # Post-processing
            chunk_strings = self._enforce_size_constraints(raw_chunks)

        # Standardize output to List[Dict[str, Any]] and align character index offsets
        chunks = []
        current_search_index = 0
        for idx, chunk_text in enumerate(chunk_strings):
            char_start = text.find(chunk_text, current_search_index)
            if char_start != -1:
                char_end = char_start + len(chunk_text)
                current_search_index = char_end
            else:
                char_start = -1
                char_end = -1

            # Detect current active chapter and section headers
            chapter, section = self._find_active_headers(text, char_start)
            
            # Prepend context to chunk_text to enrich embeddings & LLM context
            header_prefix = ""
            if chapter:
                if section:
                    header_prefix = f"[Topic: {chapter} > {section}]\n"
                else:
                    header_prefix = f"[Topic: {chapter}]\n"
            elif section:
                header_prefix = f"[Topic: {section}]\n"
                
            enriched_text = header_prefix + chunk_text if header_prefix else chunk_text
            word_count = len(chunk_text.split())
            
            metadata = {
                "source_file": os.path.basename(source_file),
                "chunk_index": idx,
                "char_start": char_start,
                "char_end": char_end,
                "word_count": word_count,
                "chapter": chapter,
                "section": section
            }
            
            chunks.append({
                "text": enriched_text,
                "metadata": metadata
            })

        return chunks

    # ------------------------------------------------------------------
    # Internal helpers (same algorithms as before)
    # ------------------------------------------------------------------

    @staticmethod
    def _split_into_sentences(text: str) -> List[str]:
        text = text.replace("\r\n", "\n")
        pattern = r'(?<=[.!?])\s+'
        raw = re.split(pattern, text)

        sentences: List[str] = []
        for segment in raw:
            parts = re.split(r'\n{2,}', segment)
            sentences.extend(parts)

        return [s.strip() for s in sentences if s.strip()]

    @staticmethod
    def _cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 1.0
        similarity = dot / (norm_a * norm_b)
        return float(1.0 - similarity)

    def _compute_consecutive_distances(self, embeddings: np.ndarray) -> List[float]:
        distances: List[float] = []
        for i in range(len(embeddings) - 1):
            dist = self._cosine_distance(embeddings[i], embeddings[i + 1])
            distances.append(dist)
        return distances

    def _find_breakpoints(self, distances: List[float]) -> List[int]:
        if not distances:
            return []
        threshold = float(np.percentile(distances, self.percentile_threshold))
        return [i for i, d in enumerate(distances) if d >= threshold]

    @staticmethod
    def _group_sentences(sentences: List[str], breakpoints: List[int]) -> List[str]:
        chunks: List[str] = []
        start = 0
        for bp in sorted(breakpoints):
            end = bp + 1
            chunk_text = " ".join(sentences[start:end]).strip()
            if chunk_text:
                chunks.append(chunk_text)
            start = end

        if start < len(sentences):
            chunk_text = " ".join(sentences[start:]).strip()
            if chunk_text:
                chunks.append(chunk_text)

        return chunks

    def _enforce_size_constraints(self, chunks: List[str]) -> List[str]:
        merged: List[str] = []
        buffer = ""
        for chunk in chunks:
            if buffer:
                combined = buffer + " " + chunk
                if len(combined) <= self.max_chunk_size:
                    buffer = combined
                else:
                    merged.append(buffer.strip())
                    buffer = chunk
            else:
                buffer = chunk

            if len(buffer) >= self.min_chunk_size:
                merged.append(buffer.strip())
                buffer = ""

        if buffer.strip():
            if merged and len(merged[-1]) + len(buffer) + 1 <= self.max_chunk_size:
                merged[-1] = merged[-1] + " " + buffer.strip()
            else:
                merged.append(buffer.strip())

        final: List[str] = []
        for chunk in merged:
            if len(chunk) <= self.max_chunk_size:
                final.append(chunk)
            else:
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
