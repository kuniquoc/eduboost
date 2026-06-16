"""Migrate legacy response JSONL files into the new eval format."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _parse_line(line: str, line_number: int, input_path: Path) -> Any:
    try:
        return json.loads(line)
    except json.JSONDecodeError as error:
        raise ValueError(
            f"Invalid JSON at {input_path}:{line_number} -> {error.msg}"
        ) from error


def _looks_like_new_format(payload: Any) -> bool:
    if not isinstance(payload, dict):
        return False
    required = {"record_id", "task_type", "model", "response_text", "parsed_json"}
    return required.issubset(payload.keys())


def _normalize_legacy_payload(payload: Any, task_type: str) -> tuple[str, Any]:
    """Return `(response_text, parsed_json)` from a legacy item."""
    if task_type == "quiz":
        if isinstance(payload, dict):
            return json.dumps(payload, ensure_ascii=False), payload
        if isinstance(payload, str):
            try:
                parsed = json.loads(payload)
                if isinstance(parsed, dict):
                    return payload, parsed
            except json.JSONDecodeError:
                pass
            return payload, None
        return str(payload), None

    if isinstance(payload, str):
        return payload, None
    return json.dumps(payload, ensure_ascii=False), None


def _build_migrated_record(
    payload: Any,
    index: int,
    task_type: str,
    model_label: str,
) -> dict[str, Any]:
    if _looks_like_new_format(payload):
        record = dict(payload)
        record["record_id"] = index
        record["task_type"] = task_type
        if model_label:
            record["model"] = model_label
        return record

    response_text, parsed_json = _normalize_legacy_payload(payload, task_type)
    return {
        "record_id": index,
        "task_type": task_type,
        "model": model_label,
        "response_text": response_text,
        "parsed_json": parsed_json,
    }


def migrate_responses_file(
    input_file: str,
    output_file: str | None,
    task_type: str,
    model_label: str,
    in_place: bool = False,
    overwrite: bool = False,
) -> Path:
    """Migrate a legacy response file to the current JSONL record schema."""
    if task_type not in {"quiz", "explanation"}:
        raise ValueError("task_type must be 'quiz' or 'explanation'.")

    input_path = Path(input_file)
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if in_place:
        target_path = input_path
    else:
        target_path = Path(output_file) if output_file else input_path.with_name(f"{input_path.stem}_migrated{input_path.suffix}")

    if target_path.exists() and not in_place and not overwrite:
        raise FileExistsError(
            f"Output file already exists: {target_path}. Use --overwrite to replace it."
        )

    with open(input_path, "r", encoding="utf-8") as handle:
        lines = [line.rstrip("\n") for line in handle if line.strip()]

    migrated = []
    for idx, line in enumerate(lines):
        payload = _parse_line(line, idx + 1, input_path)
        migrated.append(_build_migrated_record(payload, idx, task_type, model_label))

    temp_path = target_path.with_suffix(f"{target_path.suffix}.tmp")
    with open(temp_path, "w", encoding="utf-8") as handle:
        for record in migrated:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    temp_path.replace(target_path)
    return target_path
