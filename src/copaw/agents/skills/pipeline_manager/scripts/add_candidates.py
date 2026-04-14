#!/usr/bin/env python3
"""Add multiple candidates to the bound job pipeline of the current chat."""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any


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


def _parse_json_arg(raw: str | None) -> Any:
    if not raw:
        return None
    return json.loads(raw)


def _print(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False))


def _load_payload(args: argparse.Namespace) -> Any:
    if args.requests_file:
        return json.loads(Path(args.requests_file).expanduser().read_text(encoding="utf-8"))
    if args.requests_json:
        return _parse_json_arg(args.requests_json)
    raise ValueError("缺少批量候选人数据，请传 --requests-file 或 --requests-json")


def _normalize_request_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        if isinstance(payload.get("requests"), list):
            items = payload["requests"]
        else:
            items = [payload]
    elif isinstance(payload, list):
        items = payload
    else:
        raise ValueError("批量候选人数据必须是 JSON 数组或包含 requests 的对象")

    if not items:
        raise ValueError("至少需要一位候选人")

    normalized: list[dict[str, Any]] = []
    candidate_fields = {
        "id",
        "source_platform",
        "source_candidate_key",
        "name",
        "gender",
        "age",
        "school",
        "education_experience",
        "current_title",
        "current_company",
        "latest_work_experience",
        "city",
        "years_experience",
        "education",
        "current_salary",
        "expected_salary",
        "resume_snapshot",
        "resume_detail_url",
        "avatar_url",
    }
    request_fields = {
        "stage",
        "source_type",
        "recruiter_interest",
        "candidate_interest",
        "summary",
        "added_by",
        "owner_user_id",
        "source_resume_id",
    }

    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"第 {index} 位候选人的数据格式不正确")

        candidate_raw = item.get("candidate")
        if candidate_raw is None:
            candidate_raw = {
                key: value
                for key, value in item.items()
                if key in candidate_fields
            }
        if not isinstance(candidate_raw, dict):
            raise ValueError(f"第 {index} 位候选人的 candidate 字段必须是对象")

        candidate_payload = dict(candidate_raw)
        candidate_payload.setdefault("resume_snapshot", {})
        if not candidate_payload.get("name"):
            raise ValueError(f"第 {index} 位候选人缺少 name")

        request_payload = {
            key: item[key]
            for key in request_fields
            if key in item
        }
        normalized.append(
            {
                "candidate": candidate_payload,
                **request_payload,
            }
        )

    return normalized


_bootstrap_import_path()
os.environ.setdefault("COPAW_LOG_LEVEL", "error")

from copaw.app.jobs.pipeline_models import (  # noqa: E402
    AddPipelineCandidateRequest,
    CandidateProfileInput,
)
from copaw.app.jobs.pipeline_service import add_candidates_to_job_pipeline  # noqa: E402
from copaw.app.jobs.service import (  # noqa: E402
    JobChatNotBoundError,
    JobChatNotFoundError,
    JobNotFoundError,
    get_bound_job_for_chat,
)


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
        request_items = _normalize_request_items(_load_payload(args))
        requests = [
            AddPipelineCandidateRequest(
                candidate=CandidateProfileInput(**item["candidate"]),
                stage=item.get("stage", "lead"),
                source_type=item.get("source_type", "manual"),
                recruiter_interest=item.get("recruiter_interest", "unsure"),
                candidate_interest=item.get("candidate_interest", "unknown"),
                summary=item.get("summary", ""),
                added_by=item.get("added_by", "agent"),
                owner_user_id=item.get("owner_user_id", ""),
                source_chat_id=chat.id,
                source_session_id=chat.session_id,
                source_resume_id=(
                    item.get("source_resume_id")
                    or item["candidate"].get("source_candidate_key", "")
                ),
            )
            for item in request_items
        ]
        result = await add_candidates_to_job_pipeline(job.id, requests)
    except (ValueError, json.JSONDecodeError) as exc:
        _print(
            {
                "success": False,
                "error": "invalid_request",
                "message": str(exc),
            }
        )
        return 5

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
            "total": result.total,
            "created_count": result.created_count,
            "existing_count": result.existing_count,
            "results": [
                {
                    "created": item.created,
                    "entry": {
                        "id": item.entry.id,
                        "candidate_id": item.entry.candidate.id,
                        "candidate_name": item.entry.candidate.name,
                        "stage_id": item.entry.current_stage.id,
                        "stage_name": item.entry.current_stage.name,
                        "system_stage": item.entry.system_stage,
                        "source_type": item.entry.source_type,
                        "summary": item.entry.summary,
                    },
                }
                for item in result.results
            ],
        }
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Add multiple candidates to the current chat's bound job pipeline.",
    )
    parser.add_argument("--workspace-dir", required=True)
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--channel", default="console")
    parser.add_argument("--requests-file")
    parser.add_argument("--requests-json")
    args = parser.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
