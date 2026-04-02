#!/usr/bin/env python3
"""Add a candidate to the bound job pipeline of the current chat."""
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

from copaw.app.jobs.pipeline_models import (  # noqa: E402
    AddPipelineCandidateRequest,
    CandidateProfileInput,
)
from copaw.app.jobs.pipeline_service import add_candidate_to_job_pipeline  # noqa: E402
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
    except JobChatNotFoundError as exc:
        _print(
            {
                "success": False,
                "error": "chat_not_found",
                "message": str(exc),
            }
        )
        return 2
    except JobChatNotBoundError as exc:
        _print(
            {
                "success": False,
                "error": "job_not_bound",
                "message": str(exc),
            }
        )
        return 3
    except JobNotFoundError as exc:
        _print(
            {
                "success": False,
                "error": "job_not_found",
                "message": str(exc),
            }
        )
        return 4

    try:
        request = AddPipelineCandidateRequest(
            candidate=CandidateProfileInput(
                name=args.name,
                source_platform=args.source_platform,
                source_candidate_key=args.source_candidate_key,
                gender=args.gender,
                age=args.age,
                school=args.school,
                education_experience=args.education_experience,
                current_title=args.current_title,
                current_company=args.current_company,
                latest_work_experience=args.latest_work_experience,
                city=args.city,
                years_experience=args.years_experience,
                education=args.education,
                current_salary=args.current_salary,
                expected_salary=args.expected_salary,
                resume_detail_url=args.resume_detail_url,
                avatar_url=args.avatar_url,
                resume_snapshot={},
            ),
            stage=args.stage,
            source_type=args.source_type,
            recruiter_interest=args.recruiter_interest,
            candidate_interest=args.candidate_interest,
            summary=args.summary,
            added_by=args.added_by,
            source_chat_id=chat.id,
            source_session_id=chat.session_id,
            source_resume_id=args.source_resume_id or args.source_candidate_key,
        )
        result = await add_candidate_to_job_pipeline(job.id, request)
    except ValueError as exc:
        _print(
            {
                "success": False,
                "error": "invalid_request",
                "message": str(exc),
            }
        )
        return 5

    entry = result.entry
    _print(
        {
            "success": True,
            "created": result.created,
            "job": {
                "id": job.id,
                "name": job.name,
            },
            "chat": {
                "id": chat.id,
                "session_id": chat.session_id,
            },
            "entry": {
                "id": entry.id,
                "candidate_id": entry.candidate.id,
                "candidate_name": entry.candidate.name,
                "stage_id": entry.current_stage.id,
                "stage_name": entry.current_stage.name,
                "system_stage": entry.system_stage,
                "source_type": entry.source_type,
                "summary": entry.summary,
            },
        }
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Add a candidate to the current chat's bound job pipeline.",
    )
    parser.add_argument("--workspace-dir", required=True)
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--channel", default="console")
    parser.add_argument("--name", required=True)
    parser.add_argument("--source-platform", default="")
    parser.add_argument("--source-candidate-key", default="")
    parser.add_argument("--source-resume-id", default="")
    parser.add_argument("--gender", default="")
    parser.add_argument("--age")
    parser.add_argument("--school", default="")
    parser.add_argument("--education-experience", default="")
    parser.add_argument("--current-title", default="")
    parser.add_argument("--current-company", default="")
    parser.add_argument("--latest-work-experience", default="")
    parser.add_argument("--city", default="")
    parser.add_argument("--years-experience")
    parser.add_argument("--education", default="")
    parser.add_argument("--current-salary", default="")
    parser.add_argument("--expected-salary", default="")
    parser.add_argument("--resume-detail-url", default="")
    parser.add_argument("--avatar-url", default="")
    parser.add_argument("--summary", default="")
    parser.add_argument("--stage", default="lead")
    parser.add_argument("--source-type", default="manual")
    parser.add_argument("--recruiter-interest", default="unsure")
    parser.add_argument("--candidate-interest", default="unknown")
    parser.add_argument("--added-by", default="agent")
    args = parser.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
