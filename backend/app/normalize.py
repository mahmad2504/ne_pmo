import re
from urllib.parse import urlparse

from app.locations import LOCATIONS

_URL_SCHEME = re.compile(r"^([a-zA-Z][a-zA-Z0-9+.-]*):")


def blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Expected text")
    text = value.strip()
    return text or None


def normalize_tags(values: list) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in values:
        if raw is None:
            continue
        if not isinstance(raw, str):
            raise ValueError("Labels must be a list")
        text = " ".join(raw.split())
        if not text:
            continue
        if len(text) > 64:
            raise ValueError("A label can be at most 64 characters")
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(text)
    if len(cleaned) > 20:
        raise ValueError("At most 20 labels")
    return cleaned


def normalize_external_url(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("External link must be a web address")
    text = value.strip()
    if not text:
        return None
    match = _URL_SCHEME.match(text)
    if match:
        scheme = match.group(1).lower()
        if scheme not in {"http", "https"}:
            raise ValueError("External link must be an http or https address")
        text = scheme + text[len(match.group(1)):]
    elif text.startswith("//"):
        text = "https:" + text
    else:
        text = "https://" + text
    parsed = urlparse(text)
    try:
        parsed.port
    except ValueError:
        raise ValueError("External link must be an http or https address") from None
    host = parsed.hostname
    if (
        parsed.scheme not in {"http", "https"}
        or not host
        or any(char.isspace() for char in text)
        or not re.fullmatch(r"[a-zA-Z0-9.-]+", host)
    ):
        raise ValueError("External link must be an http or https address")
    if len(text) > 2048:
        raise ValueError("External link is too long")
    return text


def normalize_location(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Invalid location")
    text = value.strip()
    if not text:
        return None
    code = text.upper()
    if code not in LOCATIONS:
        raise ValueError("Invalid location")
    return code
