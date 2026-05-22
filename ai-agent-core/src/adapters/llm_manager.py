# src/adapters/llm_manager.py
#
# LLM Manager — uses OpenRouter API (OpenAI-compatible) for all LLM calls.
# Runs entirely on CPU — no local model loading.

import os
import re
import json
import logging
from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv

logger = logging.getLogger(__name__)


class LLMManager:
    """
    Manages interactions with the LLM via the OpenRouter API.

    Uses the ``openai`` client library pointed at OpenRouter's base URL.
    The model defaults to ``arcee-ai/trinity-large-thinking:free`` which
    is a free-tier reasoning model.
    """

    def __init__(self):
        load_dotenv()
        api_key = os.getenv("OPENROUTER_API_KEY", "")
        if not api_key:
            logger.warning(
                "OPENROUTER_API_KEY is not set. LLM calls will fail. "
                "Set it in the .env file or as an environment variable."
            )

        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        self.model = os.getenv("LLM_MODEL", "arcee-ai/trinity-large-thinking:free")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> str:
        """
        Send a prompt to the LLM and return the generated text.

        Args:
            prompt: The user message.
            system_prompt: Optional system-level instructions.
            max_tokens: Maximum tokens in the response.
            temperature: Sampling temperature (0 = deterministic).

        Returns:
            The assistant's reply as a string.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                extra_body={"reasoning": {"enabled": True}},
            )
            content = response.choices[0].message.content
            return content if content else ""

        except Exception as e:
            logger.error("LLM API call failed: %s", e)
            raise RuntimeError(f"LLM generation failed: {e}") from e

    def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
    ) -> dict:
        """
        Generate a response and extract JSON from it.

        The LLM often wraps JSON in markdown code-blocks (```json ... ```).
        This method handles that and falls back to scanning for ``{...}``
        or ``[...]`` patterns.
        """
        raw = self.generate(prompt, system_prompt, max_tokens=max_tokens, temperature=0.3)
        return self._extract_json(raw)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_json(text: str) -> dict:
        """
        Best-effort extraction of a JSON object from free-form LLM output.

        Tries in order:
        1. Markdown fenced code block (```json ... ``` or ``` ... ```)
        2. First ``{ ... }`` substring (greedy)
        3. Direct ``json.loads`` on the whole text
        """
        # 1. Try markdown code block
        fence_pattern = r"```(?:json)?\s*\n?(.*?)\n?\s*```"
        match = re.search(fence_pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                pass

        # 2. Try to find the outermost { ... }
        brace_start = text.find("{")
        brace_end = text.rfind("}")
        if brace_start != -1 and brace_end > brace_start:
            try:
                return json.loads(text[brace_start : brace_end + 1])
            except json.JSONDecodeError:
                pass

        # 3. Last resort — try the entire text
        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            logger.error("Failed to extract JSON from LLM output:\n%s", text[:500])
            return {
                "error": "Failed to parse JSON from LLM response",
                "raw": text[:500],
            }