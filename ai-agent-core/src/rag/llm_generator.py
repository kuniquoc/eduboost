# src/rag/llm_generator.py

import logging
from typing import List, Optional

from src.adapters.llm_manager import LLMManager, AI_UNAVAILABLE_MSG

logger = logging.getLogger(__name__)


class LLMGenerator:
    """Generates answers using custom explain endpoint or OpenAI fallback."""

    def __init__(self):
        self.llm: Optional[LLMManager] = LLMManager.from_role("explain")

        if self.llm and self.llm.is_available:
            logger.info(
                "RAG LLM Generator initialized: endpoint=%s, model=%s",
                self.llm.endpoint_url, self.llm.model,
            )
        else:
            logger.warning("RAG LLM Generator: explain LLM unavailable")

    def generate_answer(self, query: str, contexts: List[str]) -> str:
        if not self.llm or not self.llm.is_available:
            return AI_UNAVAILABLE_MSG

        combined_context = "\n\n".join(contexts)

        system_prompt = (
            "Bạn là một trợ lý RAG học tập thông minh. Hãy trả lời câu hỏi của người dùng "
            "dựa trên các đoạn ngữ cảnh sách giáo khoa được cung cấp bên dưới một cách chính xác "
            "và chi tiết bằng tiếng Việt. Nếu không thể tìm thấy câu trả lời trong ngữ cảnh, hãy nói "
            "rằng ngữ cảnh không cung cấp thông tin này, không tự bịa ra thông tin."
        )

        prompt = (
            f"Ngữ cảnh tham khảo:\n{combined_context}\n\n"
            f"Câu hỏi: {query}\n\n"
            f"Trả lời:"
        )

        answer = self.llm.generate(prompt, system_prompt=system_prompt)
        return answer if answer else AI_UNAVAILABLE_MSG
