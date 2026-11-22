from app.locations import LOCATIONS


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
