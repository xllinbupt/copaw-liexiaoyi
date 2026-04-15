"""Shared client helpers for Liexiaoxia sandbox APIs."""
from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.error
import urllib.request
from typing import Any

DEFAULT_LIEXIAOXIA_BASE_URL = (
    "http://open-techarea-sandbox20620.sandbox.tongdao.cn"
)
DEFAULT_LIEXIAOXIA_TOKEN_LIST_URL = (
    "https://vacs.tongdao.cn/visa/persionaccesstoken/list"
)
LIEXIAOXIA_TOKEN_ENV_VAR = "LIEXIAOXIA_TOKEN"

_TOKEN_KEY_CANDIDATES = (
    "token",
    "accessToken",
    "access_token",
    "personalAccessToken",
    "personal_access_token",
    "persionAccessToken",
    "persion_access_token",
    "liexiaoxiaToken",
    "value",
)
_HTML_PREFIXES = ("<!doctype html", "<html", "<?xml")


class LiexiaoxiaTokenError(RuntimeError):
    """Raised when no usable token can be resolved for Liexiaoxia APIs."""


def _trimmed(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    return ""


def _looks_like_html(text: str) -> bool:
    lowered = text.lstrip().lower()
    return any(lowered.startswith(prefix) for prefix in _HTML_PREFIXES)


def _looks_like_token(text: str) -> bool:
    if not text or len(text) < 8 or any(ch.isspace() for ch in text):
        return False
    if _looks_like_html(text):
        return False
    return bool(re.fullmatch(r"[A-Za-z0-9._\-~=+/]+", text))


def extract_liexiaoxia_token(raw_text: str) -> str | None:
    """Best-effort extraction for token list responses with unknown shape."""
    stripped = raw_text.strip()
    if not stripped:
        return None
    if _looks_like_token(stripped):
        return stripped
    try:
        payload = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    for candidate in _iter_token_candidates(payload):
        if _looks_like_token(candidate):
            return candidate
    return None


def _iter_token_candidates(node: Any) -> list[str]:
    candidates: list[str] = []
    if isinstance(node, dict):
        for key in _TOKEN_KEY_CANDIDATES:
            value = _trimmed(node.get(key))
            if value:
                candidates.append(value)
        for value in node.values():
            candidates.extend(_iter_token_candidates(value))
        return candidates
    if isinstance(node, list):
        for item in node:
            candidates.extend(_iter_token_candidates(item))
    return candidates


def _read_text_response(request: urllib.request.Request, timeout: int = 20) -> str:
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8")


def _curl_request(
    method: str,
    url: str,
    headers: dict[str, str] | None = None,
    payload: dict[str, Any] | None = None,
) -> str:
    cmd = ["curl", "-sS", "-X", method, url]
    for name, value in (headers or {}).items():
        cmd.extend(["-H", f"{name}: {value}"])
    if payload is not None:
        cmd.extend(["-d", json.dumps(payload, ensure_ascii=False)])
    result = subprocess.run(
        cmd,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def fetch_liexiaoxia_token(token_list_url: str) -> str:
    request = urllib.request.Request(token_list_url, method="GET")
    try:
        raw_text = _read_text_response(request)
    except urllib.error.HTTPError as exc:
        raise LiexiaoxiaTokenError(
            exc.read().decode("utf-8", errors="replace") or str(exc)
        ) from exc
    except urllib.error.URLError:
        try:
            raw_text = _curl_request("GET", token_list_url)
        except subprocess.CalledProcessError as exc:
            raise LiexiaoxiaTokenError(
                exc.stderr.strip() or exc.stdout.strip() or str(exc)
            ) from exc
    token = extract_liexiaoxia_token(raw_text)
    if token:
        return token
    raise LiexiaoxiaTokenError(
        "无法从 token 列表页解析出可用 token，请通过 --token 或环境变量提供。"
    )


def resolve_liexiaoxia_token(
    explicit_token: str = "",
    *,
    token_list_url: str = DEFAULT_LIEXIAOXIA_TOKEN_LIST_URL,
) -> str:
    token = _trimmed(explicit_token)
    if token:
        return token
    token = _trimmed(os.getenv(LIEXIAOXIA_TOKEN_ENV_VAR, ""))
    if token:
        return token
    token_hint = token_list_url.strip() or DEFAULT_LIEXIAOXIA_TOKEN_LIST_URL
    raise LiexiaoxiaTokenError(
        "未提供 Liexiaoxia token，请通过 --token 或环境变量 "
        f"{LIEXIAOXIA_TOKEN_ENV_VAR} 提供；"
        f"如需获取，请前往 {token_hint}。"
    )


def post_liexiaoxia_json(
    url: str,
    *,
    payload: dict[str, Any] | None = None,
    token: str,
) -> str:
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }
    body = None
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers=headers,
        method="POST",
    )
    try:
        return _read_text_response(request)
    except urllib.error.HTTPError:
        raise
    except urllib.error.URLError:
        try:
            return _curl_request("POST", url, headers=headers, payload=payload)
        except subprocess.CalledProcessError:
            raise
