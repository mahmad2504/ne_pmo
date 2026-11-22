import os

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.errors import AppError

_bearer = HTTPBearer(auto_error=False)
_jwks: PyJWKClient | None = None
_APP_ROLES = {"user", "admin"}


def _setting(name: str, default: str) -> str:
    return os.environ.get(name, default)


def _app_roles(payload: dict) -> list[str]:
    realm = payload.get("realm_access") or {}
    raw = realm.get("roles") or []
    if not isinstance(raw, list):
        return []
    return [role for role in raw if isinstance(role, str) and role in _APP_ROLES]


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise AppError(401, "Sign in, then call this route with the access token.")

    token = credentials.credentials
    issuer = _setting("KEYCLOAK_ISSUER", "http://localhost:8082/realms/logic-silicon")
    jwks_url = _setting(
        "KEYCLOAK_JWKS_URL",
        "http://localhost:8082/realms/logic-silicon/protocol/openid-connect/certs",
    )
    audience = _setting("KEYCLOAK_AUDIENCE", "backend-api")
    authorized_party = _setting("KEYCLOAK_AUTHORIZED_PARTY", "react-app")

    global _jwks
    if _jwks is None or getattr(_jwks, "uri", None) != jwks_url:
        _jwks = PyJWKClient(jwks_url)

    try:
        signing_key = _jwks.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audience,
            issuer=issuer,
            leeway=5,
        )
    except jwt.ExpiredSignatureError as exc:
        raise AppError(401, "Access token is expired. Sign in again.") from exc
    except jwt.PyJWTError as exc:
        raise AppError(401, "Access token was rejected.") from exc

    if payload.get("azp") != authorized_party:
        raise AppError(401, "Access token was not issued to the React app.")
    payload["roles"] = _app_roles(payload)
    return payload


def require_reader(user: dict = Depends(get_current_user)) -> dict:
    roles = set(user.get("roles") or [])
    if "user" not in roles and "admin" not in roles:
        raise AppError(403, "You do not have permission to view this workspace.")
    return user


def require_admin(user: dict = Depends(require_reader)) -> dict:
    if "admin" not in set(user.get("roles") or []):
        raise AppError(403, "You do not have permission to change this.")
    return user
