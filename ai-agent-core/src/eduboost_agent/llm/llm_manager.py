# src/eduboost_agent/llm/llm_manager.py
#
# LLM Manager — OpenAI-compatible API client.
# Custom endpoint takes priority; OpenAI (ChatGPT) is optional fallback.

import os
import re
import json
import logging
from typing import Literal, Optional

from openai import OpenAI
from dotenv import load_dotenv

from eduboost_agent.learning.config import LLM_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)

OPENAI_ENDPOINT = "https://api.openai.com/v1"
OPENAI_DEFAULT_MODEL = "gpt-4o-mini"
OPENAI_CHAT_MODEL = "gpt-4o"
AI_UNAVAILABLE_MSG = "AI server không khả dụng"

Role = Literal["quiz", "explain", "chat"]


def resolve_llm_config(role: Role) -> Optional[dict]:
    """
    Resolve LLM configuration for a role.

    Priority:
    1. Chat role uses OpenAI directly (CHAT_LLM_MODEL, default gpt-4o)
    2. Custom endpoint (QUIZ_LLM_ENDPOINT / EXPLAIN_LLM_ENDPOINT)
    3. OpenAI fallback when OPENAI_API_KEY is set
    4. Unavailable (returns None)
    """
    load_dotenv()

    openai_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if role == "chat":
        chat_model = (os.getenv("CHAT_LLM_MODEL") or "").strip() or OPENAI_CHAT_MODEL
        if openai_key:
            return {
                "endpoint_url": OPENAI_ENDPOINT,
                "model": chat_model,
                "api_key": openai_key,
                "requires_openai_key": True,
            }
        return None

    endpoint_var = "QUIZ_LLM_ENDPOINT" if role == "quiz" else "EXPLAIN_LLM_ENDPOINT"
    model_var = "QUIZ_LLM_MODEL" if role == "quiz" else "EXPLAIN_LLM_MODEL"

    custom_endpoint = (os.getenv(endpoint_var) or "").strip()
    custom_model = (os.getenv(model_var) or "").strip() or None

    if custom_endpoint:
        return {
            "endpoint_url": custom_endpoint,
            "model": custom_model,
            "api_key": openai_key or "not-needed",
            "requires_openai_key": False,
        }

    if openai_key:
        return {
            "endpoint_url": OPENAI_ENDPOINT,
            "model": custom_model or OPENAI_DEFAULT_MODEL,
            "api_key": openai_key,
            "requires_openai_key": True,
        }

    return None


class LLMManager:
    """Manages interactions with an LLM via OpenAI-compatible API."""

    def __init__(
        self,
        endpoint_url: str,
        model: str,
        api_key: str = "",
        requires_openai_key: bool = False,
    ):
        self.endpoint_url = endpoint_url
        self.model = model
        self.requires_openai_key = requires_openai_key
        self._api_key = api_key or ""
        self.client = OpenAI(
            base_url=endpoint_url,
            api_key=self._api_key or "not-needed",
            timeout=LLM_TIMEOUT_SECONDS,
        )

    @classmethod
    def from_role(cls, role: Role) -> Optional["LLMManager"]:
        cfg = resolve_llm_config(role)
        if not cfg:
            return None
        return cls(**cfg)

    @property
    def is_available(self) -> bool:
        if self.requires_openai_key and not self._api_key:
            return False
        return bool(self.endpoint_url and self.model)

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> Optional[str]:
        if not self.is_available:
            logger.warning("[LLM-GEN] LLM unavailable — skipping generate call")
            return None

        logger.info(
            "[LLM-GEN] Initiating call to LLM. Model: '%s', Endpoint: '%s'. Params: max_tokens=%d, temp=%.2f",
            self.model, self.endpoint_url, max_tokens, temperature,
        )

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
            )
            content = response.choices[0].message.content
            return content if content else ""
        except Exception as e:
            logger.warning("[LLM-GEN] LLM API call failed: %s", e)
            return None

    def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        max_retries: int = 2,
        temperature: float = 0.1,
    ) -> dict:
        if not self.is_available:
            logger.warning("[LLM-JSON] LLM unavailable — skipping generate_json call")
            return {"error": AI_UNAVAILABLE_MSG}

        strict_suffix = (
            "\n\nCRITICAL: Your response MUST be a valid JSON object only. "
            "Start with `{` and end with `}`. No markdown, no extra text."
        )

        result: dict = {"error": AI_UNAVAILABLE_MSG}

        for attempt in range(max_retries + 1):
            current_prompt = prompt if attempt == 0 else prompt + strict_suffix
            raw = ""

            try:
                raw = self._generate_with_json_format(
                    current_prompt, system_prompt, max_tokens, temperature
                )
            except Exception as format_exc:
                logger.warning(
                    "[LLM-JSON] response_format rejected (%s), falling back to plain generate",
                    format_exc,
                )
                raw = self.generate(
                    current_prompt, system_prompt,
                    max_tokens=max_tokens, temperature=temperature,
                ) or ""

            result = self._extract_json(raw)
            if "error" not in result:
                return result

            logger.warning(
                "[LLM-JSON] JSON extraction failed on attempt %d/%d: %s",
                attempt + 1, max_retries + 1, result.get("error"),
            )

        return result

    def _generate_with_json_format(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.1,
    ) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        return content if content else ""

    @staticmethod
    def _extract_json(text: str) -> dict:
        text = text.strip()

        fence_pattern = r"```(?:json)?\s*\n?(.*?)\n?\s*```"
        match = re.search(fence_pattern, text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(1).strip())
                if isinstance(parsed, list):
                    return {"questions": parsed}
                return parsed
            except json.JSONDecodeError:
                pass

        brace_start = text.find("{")
        brace_end = text.rfind("}")
        if brace_start != -1 and brace_end > brace_start:
            try:
                return json.loads(text[brace_start : brace_end + 1])
            except json.JSONDecodeError:
                pass

        bracket_start = text.find("[")
        bracket_end = text.rfind("]")
        if bracket_start != -1 and bracket_end > bracket_start:
            try:
                parsed = json.loads(text[bracket_start : bracket_end + 1])
                if isinstance(parsed, list):
                    return {"questions": parsed}
            except json.JSONDecodeError:
                pass

        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return {"questions": parsed}
            return parsed
        except json.JSONDecodeError:
            return {
                "error": "Failed to parse JSON from LLM response",
                "raw": text[:500],
            }
