#!/usr/bin/env python3
"""Create a minimal job and bind it to the current chat."""
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

from copaw.app.jobs.models import CreateJobFromChatRequest
from copaw.app.jobs.service import (  # noqa: E402
    JobAlreadyBoundError,
    JobChatNotFoundError,
    create_job_from_chat,
)


async def _run(args: argparse.Namespace) -> int:
    request = CreateJobFromChatRequest(
        session_id=args.session_id,
        user_id=args.user_id,
        channel=args.channel,
        name=args.name,
        description=args.description,
        requirements=args.requirements,
    )
    try:
        job, chat = await create_job_from_chat(args.workspace_dir, request)
    except JobAlreadyBoundError as exc:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": "job_already_bound",
                    "message": str(exc),
                },
                ensure_ascii=False,
            )
        )
        return 2
    except JobChatNotFoundError as exc:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": "chat_not_found",
                    "message": str(exc),
                },
                ensure_ascii=False,
            )
        )
        return 3

    print(
        json.dumps(
            {
                "success": True,
                "job": {
                    "id": job.id,
                    "name": job.name,
                    "description": job.description,
                    "requirements": job.requirements,
                    "created_at": job.created_at.isoformat().replace(
                        "+00:00", "Z"
                    ),
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


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create a minimal job and bind it to the current chat.",
    )
    parser.add_argument(
        "--workspace-dir",
        required=True,
        help="Workspace directory containing chats.json for the current agent",
    )
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--channel", default="console")
    parser.add_argument("--name", required=True)
    parser.add_argument("--description", default="")
    parser.add_argument("--requirements", default="")
    args = parser.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
