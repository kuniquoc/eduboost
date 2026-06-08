# Quiz Parsers & Helpers (main.py)

## Hàm

| Hàm | Mô tả |
|-----|-------|
| `_parse_is_correct` | Parse isCorrect bool/int/str |
| `_normalize_question_text` | Dedup key alphanumeric |
| `_normalize_answer_text` | Option text compare |
| `_resolve_correct_letter` | Map letter/text → A-D |
| `_parse_single_question` | Validate one MCQ |
| `_split_context_blob` | Rotate RAG context per question |
| `_load_quiz_context_from_rag` | FAISS by document_id |
| `_load_quiz_context_from_doc_url` | Download + rank chunks |
| `_seed_seen_from_existing` | Dedup from prior questions |
| `_is_duplicate_question` | Duplicate check |