# -*- coding: utf-8 -*-
"""Tests for external recruitment job linking helpers."""
import json
from pathlib import Path

import pytest

from copaw.app.jobs.external_identity import (
    DEFAULT_LIEPIN_ACCOUNT_KEY,
    LIST_SNAPSHOT_IDENTITY_SOURCE,
    RAW_EJOB_IDENTITY_SOURCE,
    build_liepin_listing_external_job_id,
    resolve_liepin_external_job_id,
)
from copaw.app.jobs import external_service
from copaw.app.jobs import service as jobs_service


def _write_jobs_file(jobs_path: Path, jobs: list[dict]) -> None:
    jobs_path.parent.mkdir(parents=True, exist_ok=True)
    jobs_path.write_text(
        json.dumps({"version": 1, "jobs": jobs}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


@pytest.mark.asyncio
async def test_upsert_job_external_link_creates_account_and_link(
    tmp_path: Path,
    monkeypatch,
):
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    accounts_path = tmp_path / "global" / "recruitment_platform_accounts.json"
    links_path = tmp_path / "global" / "recruitment_external_job_links.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_platform_accounts_path",
        lambda: accounts_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_external_job_links_path",
        lambda: links_path,
    )
    _write_jobs_file(
        jobs_path,
        [
            {
                "id": "job-1",
                "name": "AI 产品经理",
                "description": "负责 AI 产品规划",
                "requirements": "有 Agent 产品经验",
                "status": "进行中",
                "pending_feedback_count": 0,
                "source_session_id": "session-1",
                "source_user_id": "user-1",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
            }
        ],
    )

    link = await external_service.upsert_job_external_link(
        job_id="job-1",
        platform="liepin",
        external_job_id="ejob-1001",
        account_key="liepin-main",
        account_name="猎聘主账号",
        external_job_title="AI 产品经理（企业版）",
        external_job_url="https://example.com/job/1001",
        external_status="开放中",
        remote_snapshot={"ejobId": 1001, "dqName": "北京"},
        metadata={"source": "test"},
    )

    assert link.job_id == "job-1"
    assert link.platform == "liepin"
    assert link.external_job_id == "ejob-1001"
    assert link.external_job_title == "AI 产品经理（企业版）"
    assert link.account_name == "猎聘主账号"
    assert link.remote_snapshot == {"ejobId": 1001, "dqName": "北京"}
    assert link.metadata == {"source": "test"}

    accounts_payload = json.loads(accounts_path.read_text(encoding="utf-8"))
    assert len(accounts_payload["accounts"]) == 1
    assert accounts_payload["accounts"][0]["platform"] == "liepin"
    assert accounts_payload["accounts"][0]["account_key"] == "liepin-main"
    assert accounts_payload["accounts"][0]["account_name"] == "猎聘主账号"

    links_payload = json.loads(links_path.read_text(encoding="utf-8"))
    assert len(links_payload["links"]) == 1
    assert links_payload["links"][0]["job_id"] == "job-1"
    assert links_payload["links"][0]["external_job_id"] == "ejob-1001"
    assert links_payload["links"][0]["status"] == "active"
    assert links_payload["links"][0]["sync_status"] == "success"


@pytest.mark.asyncio
async def test_upsert_job_external_link_uses_snapshot_url_pc_when_direct_url_missing(
    tmp_path: Path,
    monkeypatch,
):
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    accounts_path = tmp_path / "global" / "recruitment_platform_accounts.json"
    links_path = tmp_path / "global" / "recruitment_external_job_links.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_platform_accounts_path",
        lambda: accounts_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_external_job_links_path",
        lambda: links_path,
    )
    _write_jobs_file(
        jobs_path,
        [
            {
                "id": "job-1",
                "name": "AI 产品经理",
                "description": "",
                "requirements": "",
                "status": "进行中",
                "pending_feedback_count": 0,
                "source_session_id": "session-1",
                "source_user_id": "user-1",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
            }
        ],
    )

    link = await external_service.upsert_job_external_link(
        job_id="job-1",
        platform="liepin",
        external_job_id="ejob-1001",
        account_key="liepin-main",
        account_name="猎聘主账号",
        external_job_title="AI 产品经理（企业版）",
        remote_snapshot={
            "ejobId": 1001,
            "urlPc": "https://lpt.liepin.com/job/detail?ejobId=1001",
        },
    )

    assert (
        link.external_job_url
        == "https://lpt.liepin.com/job/detail?ejobId=1001"
    )

    links_payload = json.loads(links_path.read_text(encoding="utf-8"))
    assert (
        links_payload["links"][0]["external_job_url"]
        == "https://lpt.liepin.com/job/detail?ejobId=1001"
    )


@pytest.mark.asyncio
async def test_upsert_job_external_link_prefers_direct_url_over_snapshot_url(
    tmp_path: Path,
    monkeypatch,
):
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    accounts_path = tmp_path / "global" / "recruitment_platform_accounts.json"
    links_path = tmp_path / "global" / "recruitment_external_job_links.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_platform_accounts_path",
        lambda: accounts_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_external_job_links_path",
        lambda: links_path,
    )
    _write_jobs_file(
        jobs_path,
        [
            {
                "id": "job-1",
                "name": "AI 产品经理",
                "description": "",
                "requirements": "",
                "status": "进行中",
                "pending_feedback_count": 0,
                "source_session_id": "session-1",
                "source_user_id": "user-1",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
            }
        ],
    )

    link = await external_service.upsert_job_external_link(
        job_id="job-1",
        platform="liepin",
        external_job_id="ejob-1001",
        account_key="liepin-main",
        account_name="猎聘主账号",
        external_job_title="AI 产品经理（企业版）",
        external_job_url="https://vip.liepin.com/override",
        remote_snapshot={
            "ejobId": 1001,
            "urlPc": "https://lpt.liepin.com/job/detail?ejobId=1001",
        },
    )

    assert link.external_job_url == "https://vip.liepin.com/override"


@pytest.mark.asyncio
async def test_upsert_job_external_link_ignores_fabricated_liepin_placeholder_url(
    tmp_path: Path,
    monkeypatch,
):
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    accounts_path = tmp_path / "global" / "recruitment_platform_accounts.json"
    links_path = tmp_path / "global" / "recruitment_external_job_links.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_platform_accounts_path",
        lambda: accounts_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_external_job_links_path",
        lambda: links_path,
    )
    _write_jobs_file(
        jobs_path,
        [
            {
                "id": "job-1",
                "name": "Agent 产品经理",
                "description": "",
                "requirements": "",
                "status": "进行中",
                "pending_feedback_count": 0,
                "source_session_id": "session-1",
                "source_user_id": "user-1",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
            }
        ],
    )

    link = await external_service.upsert_job_external_link(
        job_id="job-1",
        platform="liepin",
        external_job_id="liepin:list:7b2c7c37f57d0da8",
        account_key="liepin-main",
        account_name="猎聘主账号",
        external_job_title="Agent 产品经理",
        external_job_url="https://lpt.liepin.com/job/7b2c7c37f57d0da8",
        remote_snapshot={},
    )

    assert link.external_job_url == ""

    links_payload = json.loads(links_path.read_text(encoding="utf-8"))
    assert links_payload["links"][0]["external_job_url"] == ""


@pytest.mark.asyncio
async def test_upsert_job_external_link_prefers_snapshot_url_over_fabricated_placeholder_url(
    tmp_path: Path,
    monkeypatch,
):
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    accounts_path = tmp_path / "global" / "recruitment_platform_accounts.json"
    links_path = tmp_path / "global" / "recruitment_external_job_links.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_platform_accounts_path",
        lambda: accounts_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_external_job_links_path",
        lambda: links_path,
    )
    _write_jobs_file(
        jobs_path,
        [
            {
                "id": "job-1",
                "name": "Agent 产品经理",
                "description": "",
                "requirements": "",
                "status": "进行中",
                "pending_feedback_count": 0,
                "source_session_id": "session-1",
                "source_user_id": "user-1",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
            }
        ],
    )

    link = await external_service.upsert_job_external_link(
        job_id="job-1",
        platform="liepin",
        external_job_id="liepin:list:7b2c7c37f57d0da8",
        account_key="liepin-main",
        account_name="猎聘主账号",
        external_job_title="Agent 产品经理",
        external_job_url="https://lpt.liepin.com/job/7b2c7c37f57d0da8",
        remote_snapshot={
            "ejobPcUrl": "https://lpt.liepin.com/job/detail/preview?ejob_id=456",
        },
    )

    assert (
        link.external_job_url
        == "https://lpt.liepin.com/job/detail/preview?ejob_id=456"
    )


@pytest.mark.asyncio
async def test_upsert_job_external_link_allows_same_external_job_across_jobs(
    tmp_path: Path,
    monkeypatch,
):
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    accounts_path = tmp_path / "global" / "recruitment_platform_accounts.json"
    links_path = tmp_path / "global" / "recruitment_external_job_links.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_platform_accounts_path",
        lambda: accounts_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_external_job_links_path",
        lambda: links_path,
    )
    _write_jobs_file(
        jobs_path,
        [
            {
                "id": "job-1",
                "name": "AI 产品经理",
                "description": "",
                "requirements": "",
                "status": "进行中",
                "pending_feedback_count": 0,
                "source_session_id": "session-1",
                "source_user_id": "user-1",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
            },
            {
                "id": "job-2",
                "name": "算法工程师",
                "description": "",
                "requirements": "",
                "status": "进行中",
                "pending_feedback_count": 0,
                "source_session_id": "session-2",
                "source_user_id": "user-2",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
            },
        ],
    )

    await external_service.upsert_job_external_link(
        job_id="job-1",
        platform="liepin",
        external_job_id="ejob-2002",
        account_key="liepin-main",
        account_name="猎聘主账号",
    )

    second_link = await external_service.upsert_job_external_link(
        job_id="job-2",
        platform="liepin",
        external_job_id="ejob-2002",
        account_key="liepin-main",
        account_name="猎聘主账号",
    )

    assert second_link.job_id == "job-2"
    links_payload = json.loads(links_path.read_text(encoding="utf-8"))
    assert len(links_payload["links"]) == 2


@pytest.mark.asyncio
async def test_upsert_job_external_link_rejects_second_active_link_for_same_job(
    tmp_path: Path,
    monkeypatch,
):
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    accounts_path = tmp_path / "global" / "recruitment_platform_accounts.json"
    links_path = tmp_path / "global" / "recruitment_external_job_links.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_platform_accounts_path",
        lambda: accounts_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_external_job_links_path",
        lambda: links_path,
    )
    _write_jobs_file(
        jobs_path,
        [
            {
                "id": "job-1",
                "name": "AI 产品经理",
                "description": "",
                "requirements": "",
                "status": "进行中",
                "pending_feedback_count": 0,
                "source_session_id": "session-1",
                "source_user_id": "user-1",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
            },
        ],
    )

    await external_service.upsert_job_external_link(
        job_id="job-1",
        platform="liepin",
        external_job_id="ejob-2002",
        account_key="liepin-main",
        account_name="猎聘主账号",
    )

    with pytest.raises(external_service.ExternalJobLinkConflictError):
        await external_service.upsert_job_external_link(
            job_id="job-1",
            platform="liepin",
            external_job_id="ejob-3003",
            account_key="liepin-main",
            account_name="猎聘主账号",
        )


def test_build_liepin_listing_external_job_id_is_stable() -> None:
    fallback_id = build_liepin_listing_external_job_id(
        account_key=DEFAULT_LIEPIN_ACCOUNT_KEY,
        job={
            "ejobTitle": "B 端产品经理",
            "dqName": "北京-朝阳区",
            "salaryShow": "20-30k",
            "refreshTime": "20260108134425",
            "ejobTypeName": "社招职位",
            "ejobSubTypeName": "无子类型",
        },
    )

    assert fallback_id == "liepin:list:5351cab3116f0b29"


def test_resolve_liepin_external_job_id_prefers_raw_ejob_id() -> None:
    external_job_id, identity_source = resolve_liepin_external_job_id(
        account_key=DEFAULT_LIEPIN_ACCOUNT_KEY,
        job={
            "ejobId": 10086,
            "ejobTitle": "Agent 产品经理",
            "dqName": "北京-朝阳区",
        },
    )

    assert external_job_id == "10086"
    assert identity_source == RAW_EJOB_IDENTITY_SOURCE


def test_resolve_liepin_external_job_id_falls_back_when_raw_id_missing() -> None:
    external_job_id, identity_source = resolve_liepin_external_job_id(
        account_key=DEFAULT_LIEPIN_ACCOUNT_KEY,
        job={
            "ejobId": None,
            "ejobTitle": "B 端产品经理",
            "dqName": "北京-朝阳区",
            "salaryShow": "20-30k",
            "refreshTime": "20260108134425",
            "ejobTypeName": "社招职位",
            "ejobSubTypeName": "无子类型",
        },
    )

    assert external_job_id == "liepin:list:5351cab3116f0b29"
    assert identity_source == LIST_SNAPSHOT_IDENTITY_SOURCE


@pytest.mark.asyncio
async def test_upsert_job_external_link_upgrades_list_snapshot_link(
    tmp_path: Path,
    monkeypatch,
):
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    accounts_path = tmp_path / "global" / "recruitment_platform_accounts.json"
    links_path = tmp_path / "global" / "recruitment_external_job_links.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_platform_accounts_path",
        lambda: accounts_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_external_job_links_path",
        lambda: links_path,
    )
    _write_jobs_file(
        jobs_path,
        [
            {
                "id": "job-1",
                "name": "B端产品经理",
                "description": "",
                "requirements": "",
                "status": "进行中",
                "pending_feedback_count": 0,
                "source_session_id": "session-1",
                "source_user_id": "user-1",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
            }
        ],
    )

    fallback_id = build_liepin_listing_external_job_id(
        account_key="liepin-main",
        job={
            "ejobTitle": "B 端产品经理",
            "dqName": "北京-朝阳区",
            "salaryShow": "20-30k",
            "refreshTime": "20260108134425",
            "ejobTypeName": "社招职位",
            "ejobSubTypeName": "无子类型",
        },
    )

    await external_service.upsert_job_external_link(
        job_id="job-1",
        platform="liepin",
        external_job_id=fallback_id,
        account_key="liepin-main",
        account_name="猎聘主账号",
        external_job_title="B 端产品经理",
        metadata={
            "identity_source": LIST_SNAPSHOT_IDENTITY_SOURCE,
            "list_refresh_time": "20260108134425",
        },
    )

    upgraded = await external_service.upsert_job_external_link(
        job_id="job-1",
        platform="liepin",
        external_job_id="ejob-3003",
        account_key="liepin-main",
        account_name="猎聘主账号",
        external_job_title="B 端产品经理",
        remote_snapshot={"ejobId": 3003},
        metadata={"list_refresh_time": "20260108134425"},
    )

    assert upgraded.external_job_id == "ejob-3003"
    assert upgraded.remote_snapshot == {"ejobId": 3003}

    links_payload = json.loads(links_path.read_text(encoding="utf-8"))
    assert len(links_payload["links"]) == 1
    assert links_payload["links"][0]["external_job_id"] == "ejob-3003"


@pytest.mark.asyncio
async def test_unlink_job_external_link_marks_link_unlinked(
    tmp_path: Path,
    monkeypatch,
):
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    accounts_path = tmp_path / "global" / "recruitment_platform_accounts.json"
    links_path = tmp_path / "global" / "recruitment_external_job_links.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_platform_accounts_path",
        lambda: accounts_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_external_job_links_path",
        lambda: links_path,
    )
    _write_jobs_file(
        jobs_path,
        [
            {
                "id": "job-1",
                "name": "AI 产品经理",
                "description": "",
                "requirements": "",
                "status": "进行中",
                "pending_feedback_count": 0,
                "source_session_id": "session-1",
                "source_user_id": "user-1",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
            }
        ],
    )

    link = await external_service.upsert_job_external_link(
        job_id="job-1",
        platform="liepin",
        external_job_id="ejob-1001",
        account_key="liepin-main",
        account_name="猎聘主账号",
        external_job_title="AI 产品经理（企业版）",
    )

    unlinked = await external_service.unlink_job_external_link(
        job_id="job-1",
        link_id=link.id,
    )

    assert unlinked.status == "unlinked"
    links_payload = json.loads(links_path.read_text(encoding="utf-8"))
    assert links_payload["links"][0]["status"] == "unlinked"


@pytest.mark.asyncio
async def test_unlink_job_external_link_raises_for_missing_link(
    tmp_path: Path,
    monkeypatch,
):
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    accounts_path = tmp_path / "global" / "recruitment_platform_accounts.json"
    links_path = tmp_path / "global" / "recruitment_external_job_links.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_platform_accounts_path",
        lambda: accounts_path,
    )
    monkeypatch.setattr(
        external_service,
        "get_recruitment_external_job_links_path",
        lambda: links_path,
    )
    _write_jobs_file(
        jobs_path,
        [
            {
                "id": "job-1",
                "name": "AI 产品经理",
                "description": "",
                "requirements": "",
                "status": "进行中",
                "pending_feedback_count": 0,
                "source_session_id": "session-1",
                "source_user_id": "user-1",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
            }
        ],
    )

    with pytest.raises(external_service.ExternalJobLinkNotFoundError):
        await external_service.unlink_job_external_link(
            job_id="job-1",
            link_id="missing-link",
        )
