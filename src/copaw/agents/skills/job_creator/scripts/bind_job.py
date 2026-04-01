#!/usr/bin/env python3
"""Bind an existing job to the current chat."""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
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

from copaw.app.jobs.models import BindJobToChatRequest
from copaw.app.jobs.service import (  # noqa: E402
    JobAlreadyBoundError,
    JobAmbiguousError,
    JobChatNotFoundError,
    JobNotFoundError,
    bind_job_to_chat,
)


async def _run(args: argparse.Namespace) -> int:
    request = BindJobToChatRequest(
        session_id=args.session_id,
        user_id=args.user_id,
        channel=args.channel,
        job_id=args.job_id,
        job_name=args.job_name,
    )
    try:
        job, chat = await bind_job_to_chat(args.workspace_dir, request)
    except JobAlreadyBoundError as exc:
        code, err = 2, "job_already_bound"
        msg = str(exc)
    except JobChatNotFoundError as exc:
        code, err = 3, "chat_not_found"
        msg = str(exc)
    except JobNotFoundError as exc:
        code, err = 4, "job_not_found"
        msg = str(exc)
    except JobAmbiguousError as exc:
        code, err = 5, "job_ambiguous"
        msg = str(exc)
    except ValueError as exc:
        code, err = 6, "invalid_request"
        msg = str(exc)
    else:
        print(
            json.dumps(
                {
                    "success": True,
                    "job": {
                        "id": job.id,
                        "name": job.name,
                    },
                    "chat": {
                        "id": chat.id,
                        "name": chat.name,
                        "session_id": chat.session_id,
                        "job_id": job.id,
                        "job_name": job.name,
                    },
                },
                ensure_ascii=False,
            )
        )
        return 0

    print(
        json.dumps(
            {
                "success": False,
                "error": err,
                "message": msg,
            },
            ensure_ascii=False,
        )
    )
    return code


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bind an existing job to the current chat.",
    )
    parser.add_argument("--workspace-dir", required=True)
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--channel", default="console")
    parser.add_argument("--job-id")
    parser.add_argument("--job-name")
    args = parser.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
