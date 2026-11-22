from app.locations import LOCATIONS


def blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Expected text")
    text = value.strip()
    return text or None


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
