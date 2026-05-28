# src/rag/llm_generator.py

import os
import logging
from typing import List
from dotenv import load_dotenv
from src.adapters.llm_manager import LLMManager

logger = logging.getLogger(__name__)

class LLMGenerator:
    """Generates answers using the user's pre-configured cloud Explanation LLM (LLMManager) with OpenRouter fallback."""

    def __init__(self):
        """Initialize the LLM Generator using pre-configured cloud LLM adapter endpoints."""
        load_dotenv()
        self.explain_endpoint = os.getenv("EXPLAIN_LLM_ENDPOINT")
        self.explain_model = os.getenv("EXPLAIN_LLM_MODEL")
        
        logger.info("Initializing RAG LLM Generator using cloud adapter:")
        logger.info("  Endpoint: %s", self.explain_endpoint or "default (OpenRouter)")
        logger.info("  Model: %s", self.explain_model or "default")

        # Instantiate the primary custom LLM
        self.llm = LLMManager(endpoint_url=self.explain_endpoint, model=self.explain_model)

    def generate_answer(self, query: str, contexts: List[str]) -> str:
        """
        Formulate prompt and generate an answer based on the provided contexts using the cloud LLMs.
        
        Args:
            query: The user question.
            contexts: Top-3 retrieved text contexts.
            
        Returns:
            The generated response string.
        """
        combined_context = "\n\n".join(contexts)

        # Vietnamese learning prompt for student assistance
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

        logger.info("Requesting cloud LLM explanation...")
        try:
            return self.llm.generate(prompt, system_prompt=system_prompt)
        except Exception as e:
            logger.warning("Primary cloud LLM endpoint offline or failed: %s. Trying fallback default OpenRouter LLM...", e)
            try:
                # Force fallback to standard OpenRouter (by passing None for endpoint)
                fallback_llm = LLMManager(endpoint_url="", model="")
                return fallback_llm.generate(prompt, system_prompt=system_prompt)
            except Exception as ex:
                logger.error("All cloud LLM options failed: %s", ex)
                return f"Error: Failed to generate answer via cloud LLMs ({e} -> {ex})"


if __name__ == "__main__":
    # Small test suite to check functionality
    import sys
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    
    logging.basicConfig(level=logging.INFO)
    generator = LLMGenerator()
    test_context = [
        "Present Simple is used for habits. Example: I eat rice every day.",
        "Present Continuous is for actions happening now. Example: I am eating rice right now."
    ]
    test_query = "What is the difference between Present Simple and Present Continuous?"
    answer = generator.generate_answer(test_query, test_context)
    print("\nGenerated Answer:")
    print(answer)
