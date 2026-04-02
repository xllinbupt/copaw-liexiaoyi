#!/usr/bin/env python3
"""List the pipeline entries of the bound job for the current chat."""
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

from copaw.app.jobs.pipeline_service import list_job_pipeline  # noqa: E402
from copaw.app.jobs.service import (  # noqa: E402
    JobChatNotBoundError,
    JobChatNotFoundError,
    JobNotFoundError,
    get_bound_job_for_chat,
)


def _print(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False))


async def _run(args: argparse.Namespace) -> int:
    try:
        job, chat = await get_bound_job_for_chat(
            args.workspace_dir,
            session_id=args.session_id,
            user_id=args.user_id,
            channel=args.channel,
        )
        pipeline = await list_job_pipeline(job.id)
    except JobChatNotFoundError as exc:
        _print({"success": False, "error": "chat_not_found", "message": str(exc)})
        return 2
    except JobChatNotBoundError as exc:
        _print({"success": False, "error": "job_not_bound", "message": str(exc)})
        return 3
    except JobNotFoundError as exc:
        _print({"success": False, "error": "job_not_found", "message": str(exc)})
        return 4

    _print(
        {
            "success": True,
            "job": {
                "id": job.id,
                "name": job.name,
            },
            "chat": {
                "id": chat.id,
                "session_id": chat.session_id,
            },
            "stages": [
                {
                    "id": stage.id,
                    "name": stage.name,
                    "system_stage": stage.system_stage,
                }
                for stage in pipeline.stages
            ],
            "entries": [
                {
                    "id": entry.id,
                    "candidate_id": entry.candidate.id,
                    "candidate_name": entry.candidate.name,
                    "source_resume_id": entry.source_resume_id,
                    "source_type": entry.source_type,
                    "stage_id": entry.current_stage.id,
                    "stage_name": entry.current_stage.name,
                    "system_stage": entry.system_stage,
                    "summary": entry.summary,
                }
                for entry in pipeline.entries
            ],
        }
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="List the current chat's bound job pipeline.",
    )
    parser.add_argument("--workspace-dir", required=True)
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--channel", default="console")
    args = parser.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
