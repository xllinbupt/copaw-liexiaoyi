#!/usr/bin/env python3
"""Update one candidate's recruiter assessment under the bound job."""
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

from copaw.app.jobs.pipeline_models import UpdatePipelineEntryAssessmentRequest  # noqa: E402
from copaw.app.jobs.pipeline_service import (  # noqa: E402
    list_job_pipeline,
    update_pipeline_entry_assessment,
)
from copaw.app.jobs.service import (  # noqa: E402
    JobChatNotBoundError,
    JobChatNotFoundError,
    JobNotFoundError,
    get_bound_job_for_chat,
)


def _print(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False))


def _resolve_entry(entries: list, args: argparse.Namespace):
    if args.entry_id:
        for entry in entries:
            if entry.id == args.entry_id:
                return entry
        raise ValueError(f"未找到 pipeline 记录：{args.entry_id}")

    if args.candidate_id:
        matches = [entry for entry in entries if entry.candidate.id == args.candidate_id]
    elif args.source_resume_id:
        matches = [entry for entry in entries if entry.source_resume_id == args.source_resume_id]
    elif args.candidate_name:
        normalized = args.candidate_name.strip()
        matches = [entry for entry in entries if entry.candidate.name.strip() == normalized]
    else:
        raise ValueError(
            "缺少候选人定位信息，请提供 entry-id、candidate-id、source-resume-id 或 candidate-name"
        )

    if not matches:
        raise ValueError("未找到匹配的候选人 pipeline 记录")
    if len(matches) > 1:
        raise ValueError("存在多条同名或同标识候选人记录，请改用更稳定的标识")
    return matches[0]


async def _run(args: argparse.Namespace) -> int:
    try:
        job, chat = await get_bound_job_for_chat(
            args.workspace_dir,
            session_id=args.session_id,
            user_id=args.user_id,
            channel=args.channel,
        )
        pipeline = await list_job_pipeline(job.id)
        entry = _resolve_entry(pipeline.entries, args)
        result = await update_pipeline_entry_assessment(
            job.id,
            entry.id,
            UpdatePipelineEntryAssessmentRequest(
                recruiter_interest=args.recruiter_interest,
                note=args.note,
                actor_type=args.actor_type,
            ),
        )
    except JobChatNotFoundError as exc:
        _print({"success": False, "error": "chat_not_found", "message": str(exc)})
        return 2
    except JobChatNotBoundError as exc:
        _print({"success": False, "error": "job_not_bound", "message": str(exc)})
        return 3
    except JobNotFoundError as exc:
        _print({"success": False, "error": "job_not_found", "message": str(exc)})
        return 4
    except ValueError as exc:
        _print({"success": False, "error": "invalid_request", "message": str(exc)})
        return 5

    updated = result.entry
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
            "entry": {
                "id": updated.id,
                "candidate_id": updated.candidate.id,
                "candidate_name": updated.candidate.name,
                "recruiter_interest": updated.recruiter_interest,
            },
        }
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Update one candidate's recruiter assessment in the current chat's bound job pipeline.",
    )
    parser.add_argument("--workspace-dir", required=True)
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--channel", default="console")
    parser.add_argument("--entry-id", default="")
    parser.add_argument("--candidate-id", default="")
    parser.add_argument("--source-resume-id", default="")
    parser.add_argument("--candidate-name", default="")
    parser.add_argument("--recruiter-interest", required=True)
    parser.add_argument("--note", default="")
    parser.add_argument("--actor-type", default="agent")
    args = parser.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
