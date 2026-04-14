#!/usr/bin/env python3
"""Fetch a Liepin enterprise job detail from the sandbox API."""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
from pathlib import Path


def _bootstrap_import_path() -> None:
    here = Path(__file__).resolve()
    candidates = [
        Path("/app/src"),
        here.parents[5] if len(here.parents) > 5 else None,
    ]
    for candidate in candidates:
        if candidate and (candidate / "copaw").exists():
            candidate_str = str(candidate)
            if candidate_str not in sys.path:
                sys.path.insert(0, candidate_str)
            return


_bootstrap_import_path()
os.environ.setdefault("COPAW_LOG_LEVEL", "error")

from copaw.app.jobs.liexiaoxia_client import (  # noqa: E402
    DEFAULT_LIEXIAOXIA_BASE_URL,
    DEFAULT_LIEXIAOXIA_TOKEN_LIST_URL,
    LiexiaoxiaTokenError,
    post_liexiaoxia_json,
    resolve_liexiaoxia_token,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch Liepin enterprise job detail.",
    )
    parser.add_argument("--base-url", default=DEFAULT_LIEXIAOXIA_BASE_URL)
    parser.add_argument("--ejob-id", required=True, type=int)
    parser.add_argument(
        "--token",
        default="",
        help="Explicit Liexiaoxia token. Falls back to LIEXIAOXIA_TOKEN or token list URL.",
    )
    parser.add_argument(
        "--token-list-url",
        default=DEFAULT_LIEXIAOXIA_TOKEN_LIST_URL,
        help="Token list page used when no explicit token or env token is available.",
    )
    args = parser.parse_args()

    url = args.base_url.rstrip("/") + "/liexiaoxia/get_ejob_detail"
    payload = {"ejobId": args.ejob_id}
    try:
        token = resolve_liexiaoxia_token(
            args.token,
            token_list_url=args.token_list_url,
        )
    except LiexiaoxiaTokenError as exc:
        output = {
            "success": False,
            "error": "token_error",
            "message": str(exc),
        }
        print(json.dumps(output, ensure_ascii=False))
        return 5

    try:
        raw_text = post_liexiaoxia_json(url, payload=payload, token=token)
        parsed = json.loads(raw_text)
        if not isinstance(parsed, dict):
            raise ValueError("职位详情返回不是对象")
    except urllib.error.HTTPError as exc:
        output = {
            "success": False,
            "error": "http_error",
            "status_code": exc.code,
            "message": exc.read().decode("utf-8", errors="replace"),
        }
        print(json.dumps(output, ensure_ascii=False))
        return 2
    except (ValueError, json.JSONDecodeError) as exc:
        output = {
            "success": False,
            "error": "invalid_response",
            "message": str(exc),
            "raw_text": raw_text if "raw_text" in locals() else "",
        }
        print(json.dumps(output, ensure_ascii=False))
        return 4
    except Exception as exc:
        output = {
            "success": False,
            "error": "network_error",
            "message": str(exc),
        }
        print(json.dumps(output, ensure_ascii=False))
        return 3

    output = {
        "success": True,
        "action": "job_get",
        "job_id": str(args.ejob_id),
        "job": parsed,
    }
    print(json.dumps(output, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
