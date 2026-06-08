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
    Manages interactions with an LLM via OpenAI-compatible API.

    Can connect to OpenRouter API (default) or any custom endpoint.
    Supports configurable model, endpoint URL, and API key.
    """

    def __init__(
        self,
        endpoint_url: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        """
        Initialize LLMManager with optional custom endpoint and model.
        
        Args:
            endpoint_url: Custom endpoint URL (e.g., https://api.openai.com/v1).
                         Defaults to OpenRouter if not provided.
            model: Model name/ID to use. Defaults to env var LLM_MODEL or trinity-large-thinking:free.
            api_key: API key for authentication. Defaults to OPENROUTER_API_KEY env var.
        """
        load_dotenv()
        
        # Resolve endpoint URL (treat empty string as None)
        if not endpoint_url:
            endpoint_url = os.getenv("LLM_ENDPOINT") or None
        if not endpoint_url:
            endpoint_url = "https://openrouter.ai/api/v1"
        self.endpoint_url = endpoint_url
        
        # Resolve model (treat empty string as None)
        if not model:
            model = os.getenv("LLM_MODEL") or None
        if not model:
            model = "arcee-ai/trinity-large-thinking:free"
        self.model = model
        
        # Resolve API key
        if api_key is None:
            api_key = os.getenv("OPENROUTER_API_KEY", "")
        
        if not api_key:
            logger.warning(
                "API key not set. LLM calls will fail. "
                "Set OPENROUTER_API_KEY or pass api_key parameter."
            )

        self.client = OpenAI(
            base_url=endpoint_url,
            api_key=api_key,
        )

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
        logger.info(
            "[LLM-GEN] Initiating call to LLM. Model: '%s', Endpoint: '%s'. Params: max_tokens=%d, temp=%.2f",
            self.model, self.endpoint_url, max_tokens, temperature
        )
        logger.info("[LLM-GEN] Prompt length: %d chars. System prompt length: %d chars.", len(prompt), len(system_prompt) if system_prompt else 0)
        logger.info("[LLM-GEN] Full Prompt being sent:\n%s", prompt)

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
            raw_text = content if content else ""
            logger.info("[LLM-GEN] Received reply successfully. Length: %d chars.", len(raw_text))
            logger.info("[LLM-GEN] First 500 chars of reply: %r", raw_text[:500])
            return raw_text

        except Exception as e:
            logger.error("[LLM-GEN] LLM API call failed with exception: %s", e, exc_info=True)
            raise RuntimeError(f"LLM generation failed: {e}") from e

    def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        max_retries: int = 2,
    ) -> dict:
        """
        Generate a response and extract JSON from it.

        Tries to use ``response_format={"type": "json_object"}`` for
        OpenAI-compatible endpoints that support it, falling back to
        prompt-only mode when the parameter is rejected.

        If JSON extraction fails, retries up to *max_retries* times with a
        stricter reminder appended to the prompt.
        """
        strict_suffix = (
            "\n\nCRITICAL: Your response MUST be a valid JSON object only. "
            "Start with `{` and end with `}`. No markdown, no extra text."
        )

        logger.info(
            "[LLM-JSON] Initiating generate_json. Model: '%s', max_retries=%d. Prompt len: %d",
            self.model, max_retries, len(prompt)
        )

        for attempt in range(max_retries + 1):
            current_prompt = prompt if attempt == 0 else prompt + strict_suffix
            logger.info("[LLM-JSON] Attempt %d/%d (attempt indices 0 to %d)", attempt + 1, max_retries + 1, max_retries)

            raw = ""
            try:
                logger.info("[LLM-JSON] Attempting with response_format={'type': 'json_object'}...")
                raw = self._generate_with_json_format(
                    current_prompt, system_prompt, max_tokens
                )
            except Exception as format_exc:
                logger.warning(
                    "[LLM-JSON] Endpoint rejected response_format={'type': 'json_object'} with error: %s. "
                    "Falling back to plain generate with temperature=0.1.",
                    format_exc,
                    exc_info=True
                )
                try:
                    raw = self.generate(
                        current_prompt, system_prompt,
                        max_tokens=max_tokens, temperature=0.1
                    )
                except Exception as gen_exc:
                    logger.error("[LLM-JSON] Fallback generate call failed as well: %s", gen_exc, exc_info=True)
                    raw = ""

            logger.info("[LLM-JSON] Extracting JSON from raw output (length: %d chars)...", len(raw))
            result = self._extract_json(raw)
            if "error" not in result:
                logger.info("[LLM-JSON] Successfully parsed JSON on attempt %d.", attempt + 1)
                return result

            logger.warning(
                "[LLM-JSON] JSON extraction failed on attempt %d/%d. Raw output: %r. Parser message: %s",
                attempt + 1, max_retries + 1, raw, result.get("error"),
            )

        # All retries exhausted — return the last error result
        logger.error(
            "[LLM-JSON] All %d JSON extraction attempts failed. Returning error dict.",
            max_retries + 1,
        )
        return result

    def _generate_with_json_format(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
    ) -> str:
        """Call LLM with response_format='json_object'. Raises if unsupported."""
        logger.info(
            "[LLM-JSON-FORMAT] Dispatching query with response_format. Model: '%s', Endpoint: '%s'",
            self.model, self.endpoint_url
        )
        logger.info("[LLM-JSON-FORMAT] Full Prompt being sent:\n%s", prompt)
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        raw_text = content if content else ""
        logger.info("[LLM-JSON-FORMAT] Response received. Length: %d chars.", len(raw_text))
        logger.info("[LLM-JSON-FORMAT] Response preview: %r", raw_text[:500])
        return raw_text

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_json(text: str) -> dict:
        """
        Best-effort extraction of a JSON object or array from free-form LLM output.

        Tries in order:
        1. Markdown fenced code block (```json ... ``` or ``` ... ```)
        2. First ``{ ... }`` substring (outermost braces)
        3. First ``[ ... ]`` substring (outermost brackets → wraps in dict)
        4. Direct ``json.loads`` on the stripped text
        """
        text = text.strip()

        # 1. Try markdown code block
        fence_pattern = r"```(?:json)?\s*\n?(.*?)\n?\s*```"
        match = re.search(fence_pattern, text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(1).strip())
                if isinstance(parsed, list):
                    return {"questions": parsed}
                return parsed
            except json.JSONDecodeError:
                logger.debug("JSON fenced block parse failed; falling back to brace scan.")

        # 2. Try to find the outermost { ... }
        brace_start = text.find("{")
        brace_end = text.rfind("}")
        if brace_start != -1 and brace_end > brace_start:
            try:
                return json.loads(text[brace_start : brace_end + 1])
            except json.JSONDecodeError:
                logger.debug("Brace-delimited JSON parse failed; trying bracket scan.")

        # 3. Try to find the outermost [ ... ] (LLM returned array directly)
        bracket_start = text.find("[")
        bracket_end = text.rfind("]")
        if bracket_start != -1 and bracket_end > bracket_start:
            try:
                parsed = json.loads(text[bracket_start : bracket_end + 1])
                if isinstance(parsed, list):
                    return {"questions": parsed}
            except json.JSONDecodeError:
                logger.debug("Bracket-delimited JSON parse failed; falling back to full-text parse.")

        # 4. Last resort — try the entire text
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return {"questions": parsed}
            return parsed
        except json.JSONDecodeError:
            logger.error("Failed to extract JSON from LLM output:\n%s", text[:500])
            return {
                "error": "Failed to parse JSON from LLM response",
                "raw": text[:500],
            }