"""Attribute sanitization and redaction for OpenTelemetry traces and metrics."""

import re
from typing import Any, Dict, Optional

from app.config import settings

SENSITIVE_KEY_PATTERNS = [
    re.compile(r"api[_-]?key", re.IGNORECASE),
    re.compile(r"password", re.IGNORECASE),
    re.compile(r"secret", re.IGNORECASE),
    re.compile(r"token", re.IGNORECASE),
    re.compile(r"credential", re.IGNORECASE),
    re.compile(r"auth(?:orization)?", re.IGNORECASE),
    re.compile(r"cookie", re.IGNORECASE),
]

CONTENT_REDACTION_KEYS = {
    "prompt",
    "full_prompt",
    "system_prompt",
    "response",
    "full_response",
    "content",
    "document_content",
    "chunk_content",
    "raw_text",
}

MAX_TEXT_PREVIEW_LEN = 120
REDACTED_VALUE = "[REDACTED_CREDENTIAL]"
TRUNCATED_SUFFIX = "[CONTENT_TRUNCATED"


def truncate_preview(text: str, max_length: int = MAX_TEXT_PREVIEW_LEN) -> str:
    """Truncate text to a maximum preview length with metadata suffix."""
    if len(text) > max_length:
        return f"{text[:max_length]}... [CONTENT_TRUNCATED len={len(text)}]"
    return text


def is_sensitive_key(key: str) -> bool:
    """Check if an attribute key matches sensitive patterns."""
    return any(pattern.search(key) for pattern in SENSITIVE_KEY_PATTERNS)


def sanitize_attribute_value(
    key: str,
    value: Any,
    redaction_enabled: bool = True,
    max_length: int = MAX_TEXT_PREVIEW_LEN,
) -> Any:
    """Sanitize and format attribute values for OpenTelemetry."""
    if value is None:
        return ""

    if not redaction_enabled:
        if isinstance(value, (int, float, bool)):
            return value
        return str(value)

    # 1. Mask sensitive keys immediately
    if is_sensitive_key(key):
        return REDACTED_VALUE

    # 2. Check for sensitive substrings in string values
    if isinstance(value, str):
        val_lower = value.lower()
        if any(p in val_lower for p in ["bearer ", "eyj", "sk-", "password="]):
            return REDACTED_VALUE

        # 3. Redact full prompts and raw document contents by default
        clean_key = key.lower().replace(".", "_")
        if any(ck in clean_key for ck in CONTENT_REDACTION_KEYS):
            return truncate_preview(value, max_length=max_length)

        return value

    if isinstance(value, (int, float, bool)):
        return value

    if isinstance(value, (list, tuple, set)):
        return str([sanitize_attribute_value(key, item, redaction_enabled) for item in value])

    if isinstance(value, dict):
        return str({k: sanitize_attribute_value(k, v, redaction_enabled) for k, v in value.items()})

    return str(value)


def sanitize_attributes(
    attributes: Optional[Dict[str, Any]] = None,
    redaction_enabled: Optional[bool] = None,
    max_length: int = MAX_TEXT_PREVIEW_LEN,
) -> Dict[str, Any]:
    """Sanitize an entire attribute dictionary for OpenTelemetry spans and events."""
    if not attributes:
        return {}

    enabled = (
        redaction_enabled
        if redaction_enabled is not None
        else getattr(settings, "OTEL_REDACTION_ENABLED", True)
    )

    clean_attrs: Dict[str, Any] = {}
    for k, v in attributes.items():
        clean_attrs[k] = sanitize_attribute_value(k, v, redaction_enabled=enabled, max_length=max_length)

    return clean_attrs
