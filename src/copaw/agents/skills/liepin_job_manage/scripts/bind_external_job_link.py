#!/usr/bin/env python3
"""Bind a Liepin enterprise job to a CoPaw recruitment job."""
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


def _parse_json_arg(raw: str | None) -> dict:
    if not raw:
        return {}
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("JSON 参数必须是对象")
    return value


_bootstrap_import_path()
os.environ.setdefault("COPAW_LOG_LEVEL", "error")

from copaw.app.jobs.external_service import (  # noqa: E402
    ExternalJobLinkConflictError,
    PlatformAccountNotFoundError,
    upsert_job_external_link,
)
from copaw.app.jobs.service import (  # noqa: E402
    JobChatNotBoundError,
    JobChatNotFoundError,
    JobNotFoundError,
    get_bound_job_for_chat,
)


async def _resolve_job_id(args: argparse.Namespace) -> str:
    if args.job_id:
        return args.job_id
    if not (args.session_id and args.user_id):
        raise ValueError("缺少 job_id，且无法从当前 chat 推断职位")
    job, _chat = await get_bound_job_for_chat(
        args.workspace_dir,
        session_id=args.session_id,
        user_id=args.user_id,
        channel=args.channel,
    )
    return job.id


async def _run(args: argparse.Namespace) -> int:
    remote_snapshot = _parse_json_arg(args.remote_snapshot_json)
    metadata = _parse_json_arg(args.metadata_json)
    publish_payload_snapshot = _parse_json_arg(args.publish_payload_json)
    capabilities = [
        item.strip()
        for item in (args.capabilities or "").split(",")
        if item.strip()
    ]

    try:
        job_id = await _resolve_job_id(args)
        link = await upsert_job_external_link(
            job_id=job_id,
            platform=args.platform,
            external_job_id=args.external_job_id,
            platform_account_id=args.platform_account_id,
            account_key=args.account_key,
            account_name=args.account_name,
            tenant_key=args.tenant_key,
            external_job_code=args.external_job_code,
            external_job_title=args.external_job_title,
            external_job_url=args.external_job_url,
            external_status=args.external_status,
            relation_type=args.relation_type,
            source_of_truth=args.source_of_truth,
            sync_status=args.sync_status,
            remote_snapshot=remote_snapshot,
            publish_payload_snapshot=publish_payload_snapshot,
            metadata=metadata,
            capabilities=capabilities,
            credential_ref=args.credential_ref,
        )
    except JobChatNotBoundError as exc:
        code, err = 2, "chat_not_bound"
        msg = str(exc)
    except JobChatNotFoundError as exc:
        code, err = 3, "chat_not_found"
        msg = str(exc)
    except JobNotFoundError as exc:
        code, err = 4, "job_not_found"
        msg = str(exc)
    except PlatformAccountNotFoundError as exc:
        code, err = 5, "platform_account_not_found"
        msg = str(exc)
    except ExternalJobLinkConflictError as exc:
        code, err = 6, "external_job_conflict"
        msg = str(exc)
    except (ValueError, json.JSONDecodeError) as exc:
        code, err = 7, "invalid_request"
        msg = str(exc)
    else:
        print(
            json.dumps(
                {
                    "success": True,
                    "link": link.model_dump(mode="json"),
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
        description="Bind an external enterprise job to a CoPaw job.",
    )
    parser.add_argument("--workspace-dir", required=True)
    parser.add_argument("--session-id")
    parser.add_argument("--user-id")
    parser.add_argument("--channel", default="console")
    parser.add_argument("--job-id")
    parser.add_argument("--platform", default="liepin")
    parser.add_argument("--platform-account-id")
    parser.add_argument("--account-key")
    parser.add_argument("--account-name")
    parser.add_argument("--tenant-key")
    parser.add_argument("--credential-ref")
    parser.add_argument("--capabilities")
    parser.add_argument("--external-job-id", required=True)
    parser.add_argument("--external-job-code")
    parser.add_argument("--external-job-title")
    parser.add_argument("--external-job-url")
    parser.add_argument("--external-status")
    parser.add_argument(
        "--relation-type",
        default="linked",
        choices=["imported", "published", "linked"],
    )
    parser.add_argument(
        "--source-of-truth",
        default="external_preferred",
        choices=["independent", "external_preferred", "local_preferred"],
    )
    parser.add_argument(
        "--sync-status",
        default="success",
        choices=["idle", "success", "failed"],
    )
    parser.add_argument("--remote-snapshot-json")
    parser.add_argument("--publish-payload-json")
    parser.add_argument("--metadata-json")
    args = parser.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
