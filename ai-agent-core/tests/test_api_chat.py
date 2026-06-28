"""API regression tests for chat RAG query construction."""
import unittest
from unittest.mock import MagicMock, patch

try:
    from fastapi.testclient import TestClient
    from eduboost_agent.api.main import app

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False


@unittest.skipUnless(HAS_FASTAPI, "fastapi not installed")
class TestChatTopicSearch(unittest.TestCase):
    def test_chat_search_uses_topic_enriched_query(self):
        captured = {}
        chunk_text = (
            "Present simple is used for habits and repeated actions in everyday English. "
            "Learners often use it with adverbs of frequency."
        )

        def fake_search(query, **kwargs):
            captured["query"] = query
            captured["kwargs"] = kwargs
            return [
                (
                    0.92,
                    {
                        "text": chunk_text,
                        "metadata": {
                            "document_id": "doc-chat-1",
                            "scope": "system",
                            "source_file": "grammar.txt",
                            "chunk_index": 7,
                        },
                    },
                )
            ]

        mock_db = MagicMock()
        mock_db.search = fake_search

        with patch.dict("os.environ", {"APP_ENV": "production"}), patch("eduboost_agent.api.routes.tutor.runtime") as mock_runtime:
            mock_runtime.llm_available.return_value = True
            mock_runtime.llm_chat = MagicMock()
            mock_runtime.retriever = MagicMock()
            mock_runtime.vector_db = mock_db
            mock_runtime.llm_chat.generate.return_value = "answer"

            with self.assertLogs("eduboost_agent.api.routes.tutor", level="INFO") as logs:
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
        self.assertEqual(captured["kwargs"]["return_scores"], True)
        self.assertEqual(response.json()["sources"][0]["document_id"], "doc-chat-1")
        self.assertEqual(response.json()["sources"][0]["file_name"], "grammar.txt")

        log_text = "\n".join(logs.output)
        self.assertIn('RAG query="[topic-abc What is present simple?]"', log_text)
        self.assertIn("RAG retrieval succeeded", log_text)
        self.assertIn("document_id=doc-chat-1", log_text)
        self.assertIn(f"[{chunk_text[:100]}] ...", log_text)


if __name__ == "__main__":
    unittest.main()
