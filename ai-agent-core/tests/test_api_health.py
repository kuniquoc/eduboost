"""Lightweight API smoke tests (skip when FastAPI is not installed)."""
import unittest

try:
    from fastapi.testclient import TestClient
    from src.api.main import app

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False


@unittest.skipUnless(HAS_FASTAPI, "fastapi not installed")
class TestApiHealth(unittest.TestCase):
    def test_health_returns_200(self):
        with TestClient(app) as client:
            response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "healthy")
        self.assertIn("llm", body)

    def test_tutor_next_action_requires_params(self):
        with TestClient(app) as client:
            response = client.get("/tutor/next-action")
        self.assertEqual(response.status_code, 422)
