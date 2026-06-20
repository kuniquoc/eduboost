"""API regression tests for tutor question dedupe."""
import unittest
from unittest.mock import MagicMock, patch

try:
    from fastapi.testclient import TestClient
    from src.api.main import app

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False


@unittest.skipUnless(HAS_FASTAPI, "fastapi not installed")
class TestTutorGenerateQuestionDedupe(unittest.TestCase):
    def test_post_generate_question_retries_duplicate_existing_question(self):
        duplicate_question = "She ___ to school every day!"
        new_question = "He ___ to work every day."

        mock_llm = MagicMock()
        mock_llm.model = "test-model"
        mock_llm.endpoint_url = "http://test-llm"
        mock_llm.generate_json.side_effect = [
            {
                "question": duplicate_question,
                "options": {"A": "go", "B": "goes", "C": "going", "D": "gone"},
                "correct_answer": "B",
                "explanation": "Duplicate explanation",
                "difficulty_level": 0.35,
            },
            {
                "question": new_question,
                "options": {"A": "go", "B": "goes", "C": "going", "D": "gone"},
                "correct_answer": "A",
                "explanation": "Fresh explanation",
                "difficulty_level": 0.35,
            },
        ]

        with patch("src.api.routes.tutor.runtime") as mock_runtime:
            mock_runtime.llm_quiz = mock_llm
            mock_runtime.retriever = None
            mock_runtime.llm_available.return_value = True

            with TestClient(app) as client:
                response = client.post(
                    "/tutor/generate-question",
                    json={
                        "topic_name": "English Grammar",
                        "difficulty": 0.35,
                        "existing_questions": ["She ___ to school every day."],
                    },
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["question"], new_question)
        self.assertEqual(mock_llm.generate_json.call_count, 2)

        first_prompt = mock_llm.generate_json.call_args_list[0].args[0]
        second_prompt = mock_llm.generate_json.call_args_list[1].args[0]
        self.assertIn("DO NOT generate any of the following questions", first_prompt)
        self.assertIn("She ___ to school every day.", first_prompt)
        self.assertIn("RETRY:", second_prompt)
        self.assertIn(duplicate_question, second_prompt)

    def test_post_generate_question_uses_single_retrieval_for_context_and_logging(self):
        mock_llm = MagicMock()
        mock_llm.model = "test-model"
        mock_llm.endpoint_url = "http://test-llm"
        mock_llm.generate_json.return_value = {
            "question": "He ___ to school every day.",
            "options": {"A": "go", "B": "goes", "C": "going", "D": "gone"},
            "correct_answer": "B",
            "explanation": "Present simple explanation",
            "difficulty_level": 0.35,
        }

        mock_retriever = MagicMock()
        mock_retriever.get_context_hits.return_value = [
            (
                0.88,
                {
                    "text": "Present simple is used for habits.",
                    "metadata": {"source_file": "grammar.txt", "chunk_index": 1},
                },
            )
        ]
        mock_vector_db = MagicMock()

        with patch("src.api.routes.tutor.runtime") as mock_runtime:
            mock_runtime.llm_quiz = mock_llm
            mock_runtime.retriever = mock_retriever
            mock_runtime.vector_db = mock_vector_db
            mock_runtime.llm_available.return_value = True

            with TestClient(app) as client:
                response = client.post(
                    "/tutor/generate-question",
                    json={
                        "topic_name": "English Grammar",
                        "difficulty": 0.35,
                        "allowed_document_ids": ["doc-1"],
                        "allowed_scopes": ["system"],
                    },
                )

        self.assertEqual(response.status_code, 200)
        mock_retriever.get_context_hits.assert_called_once_with(
            "English Grammar",
            allowed_document_ids=["doc-1"],
            allowed_scopes=["system"],
        )
        mock_vector_db.search.assert_not_called()
        prompt = mock_llm.generate_json.call_args.args[0]
        self.assertIn("Source 1: Present simple is used for habits.", prompt)


@unittest.skipUnless(HAS_FASTAPI, "fastapi not installed")
class TestTutorExplainErrorHint(unittest.TestCase):
    def test_explain_error_cleans_structured_heading_output(self):
        mock_llm = MagicMock()
        mock_llm.model = "test-model"
        mock_llm.endpoint_url = "http://test-llm"
        mock_llm.generate.return_value = (
            "1. **Focus clue**: Bạn hãy chú ý động từ 'couldn't stop crying'.\n"
            "2. **Guiding prompt**: Đây là một trạng thái cảm xúc kéo dài.\n"
            "3. **Socratic question**: Từ nào phù hợp với cảm xúc buồn bã trong ngữ cảnh này?\n"
            "4. **Self-check tip**: Hãy thử thay vào câu và đọc lại."
        )

        with patch("src.api.routes.tutor.runtime") as mock_runtime:
            mock_runtime.llm_explain = mock_llm
            mock_runtime.retriever = None
            mock_runtime.llm_available.return_value = True

            with TestClient(app) as client:
                response = client.post(
                    "/tutor/explain-error",
                    json={
                        "question": "She couldn't stop crying because she felt ___.",
                        "options": [
                            {"id": "A", "text": "happy"},
                            {"id": "B", "text": "sad"},
                            {"id": "C", "text": "excited"},
                            {"id": "D", "text": "hungry"},
                        ],
                        "correct_answer": "B. sad",
                    },
                )

        self.assertEqual(response.status_code, 200)
        prompt = mock_llm.generate.call_args.args[0]
        self.assertIn("## Các lựa chọn:", prompt)
        self.assertIn("- A. happy", prompt)
        self.assertIn("- B. sad", prompt)
        self.assertNotIn("Câu trả lời của học sinh", prompt)
        explanation = response.json()["explanation"]
        self.assertNotIn("Focus clue", explanation)
        self.assertNotIn("Guiding prompt", explanation)
        self.assertNotIn("Socratic question", explanation)
        self.assertNotIn("Self-check tip", explanation)
        self.assertNotIn("**", explanation)
        self.assertIn("Dấu hiệu:", explanation)
        self.assertIn("Gợi ý:", explanation)
        self.assertIn("Tự kiểm tra:", explanation)
        self.assertIn("couldn't stop crying", explanation)
        self.assertNotIn("đáp án đúng", explanation.lower())
        self.assertNotIn("sad", explanation.lower())
        self.assertEqual(len(explanation.split("\n\n")), 3)


if __name__ == "__main__":
    unittest.main()
