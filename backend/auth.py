"""Supabase access-token verification for the public API.

The app ships its Supabase anon key, so the key itself proves nothing - it is
public by design. What we actually need is the *user's* access token, which
Supabase issues after a real sign-in and which expires. We validate it by
asking Supabase who it belongs to, then cache the answer for a minute so a
chatty client does not hammer the auth server on every plan request.
"""

from __future__ import annotations

import hashlib
import os
import time
from urllib.parse import urlparse

import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()

if SUPABASE_URL:
    _parsed = urlparse(SUPABASE_URL)
    _local_host = _parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if _parsed.scheme not in {"http", "https"} or not _parsed.netloc:
        raise RuntimeError("SUPABASE_URL must be a valid http(s) URL.")
    if _parsed.scheme != "https" and not _local_host:
        raise RuntimeError(
            "SUPABASE_URL must use HTTPS outside local development."
        )

_TRUTHY = {"1", "true", "yes", "on"}
# Off by default only when Supabase is not configured, so local development
# keeps working without a token while any deployed instance is protected.
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "true").strip().lower() in _TRUTHY

_CACHE_TTL = 60.0
_CACHE_MAX = 512
_cache: dict[str, tuple[float, str]] = {}


def auth_enabled() -> bool:
    """True when this instance should require a Supabase session."""
    return bool(SUPABASE_URL) and AUTH_REQUIRED


def bearer_token(header: str | None) -> str | None:
    """Pull the token out of an ``Authorization: Bearer ...`` header."""
    if not header:
        return None
    scheme, _, value = header.partition(" ")
    if scheme.lower() != "bearer":
        return None
    token = value.strip()
    # Supabase JWTs are much shorter than this. The cap keeps a hostile header
    # from turning the auth cache key/hash or the upstream request into a DoS.
    if not token or len(token) > 8_192:
        return None
    return token


def _cache_key(token: str) -> str:
    # Keep the raw token out of process memory dumps and logs.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _remembered(key: str) -> str | None:
    cached = _cache.get(key)
    if not cached:
        return None
    expires_at, user_id = cached
    if expires_at <= time.time():
        _cache.pop(key, None)
        return None
    return user_id


def _remember(key: str, user_id: str) -> None:
    now = time.time()
    if len(_cache) >= _CACHE_MAX:
        for stale in [k for k, (exp, _) in _cache.items() if exp <= now]:
            _cache.pop(stale, None)
        if len(_cache) >= _CACHE_MAX:
            _cache.clear()
    _cache[key] = (now + _CACHE_TTL, user_id)


async def user_id_for_token(token: str) -> tuple[str | None, str | None]:
    """Validate an access token.

    Returns ``(user_id, None)`` when the token belongs to a real user, or
    ``(None, message)`` with a user-safe explanation when it does not.
    """
    key = _cache_key(token)
    remembered = _remembered(key)
    if remembered:
        return remembered, None

    headers = {"Authorization": f"Bearer {token}"}
    if SUPABASE_ANON_KEY:
        headers["apikey"] = SUPABASE_ANON_KEY

    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=False) as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user", headers=headers
            )
    except httpx.HTTPError:
        return None, "Could not reach Supabase to verify your session."

    if response.status_code != 200:
        return None, "Your session has expired. Please sign in again."

    try:
        payload = response.json()
    except ValueError:
        return None, "Supabase returned an unexpected response."

    user_id = payload.get("id")
    if not isinstance(user_id, str) or not user_id.strip():
        return None, "Supabase returned an unexpected response."

    _remember(key, user_id)
    return user_id, None
