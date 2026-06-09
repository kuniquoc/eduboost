"""API regression tests for chat RAG query construction."""
import unittest
from unittest.mock import MagicMock, patch

try:
    from fastapi.testclient import TestClient
    from src.api.main import app

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False


@unittest.skipUnless(HAS_FASTAPI, "fastapi not installed")
class TestChatTopicSearch(unittest.TestCase):
    def test_chat_search_uses_topic_enriched_query(self):
        captured = {}

        def fake_search(query, **kwargs):
            captured["query"] = query
            return []

        mock_db = MagicMock()
        mock_db.search = fake_search

        with patch("src.api.routes.tutor.runtime") as mock_runtime:
            mock_runtime.llm_available.return_value = True
            mock_runtime.llm_explain = MagicMock()
            mock_runtime.retriever = MagicMock()
            mock_runtime.vector_db = mock_db
            mock_runtime.llm_explain.invoke.return_value = MagicMock(content="answer")

            with TestClient(app) as client:
                response = client.post(
                    "/tutor/chat",
                    json={
                        "question": "What is present simple?",
                        "topic_id": "topic-abc",
                        "level": "intermediate",
                        "history": [],
                    },
                )

        self.assertEqual(response.status_code, 200)
        self.assertIn("topic-abc", captured.get("query", ""))
        self.assertIn("What is present simple?", captured.get("query", ""))


if __name__ == "__main__":
    unittest.main()
