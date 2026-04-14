# -*- coding: utf-8 -*-
"""Services for external recruitment platform relations."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .external_identity import LIST_SNAPSHOT_IDENTITY_SOURCE
from .external_models import ExternalJobLink, ExternalJobLinkView, RecruitPlatformAccount
from .paths import (
    get_recruitment_external_job_links_path,
    get_recruitment_platform_accounts_path,
)
from .repo.external_json_repo import (
    JsonExternalJobLinkRepository,
    JsonRecruitPlatformAccountRepository,
)
from .service import JobNotFoundError, get_job


class PlatformAccountNotFoundError(RuntimeError):
    """Raised when the target platform account does not exist."""


class ExternalJobLinkConflictError(RuntimeError):
    """Raised when the requested external-link rule would be violated."""


class ExternalJobLinkNotFoundError(RuntimeError):
    """Raised when the target external job link cannot be found."""


def _trimmed(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    return ""


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _metadata_value(metadata: dict[str, Any] | None, key: str) -> str:
    if not isinstance(metadata, dict):
        return ""
    return _trimmed(metadata.get(key))


def _resolve_snapshot_job_url(remote_snapshot: dict[str, Any] | None) -> str:
    if not isinstance(remote_snapshot, dict):
        return ""
    for key in ("urlPc", "ejobPcUrl", "pcUrl", "jobUrl", "url"):
        value = remote_snapshot.get(key)
        normalized = _trimmed(value)
        if normalized:
            return normalized
    return ""


def _is_liepin_list_placeholder_id(
    *,
    platform: str | None,
    external_job_id: str | None,
) -> bool:
    normalized_platform = _trimmed(platform).lower()
    normalized_external_job_id = _trimmed(external_job_id)
    return (
        normalized_platform == "liepin"
        and normalized_external_job_id.startswith("liepin:list:")
    )


def _is_fabricated_liepin_placeholder_url(
    *,
    platform: str | None,
    external_job_id: str | None,
    url: str | None,
) -> bool:
    if not _is_liepin_list_placeholder_id(
        platform=platform,
        external_job_id=external_job_id,
    ):
        return False
    normalized_url = _trimmed(url).rstrip("/")
    if not normalized_url:
        return False
    placeholder_suffix = _trimmed(external_job_id).rsplit(":", 1)[-1]
    return normalized_url in {
        f"https://lpt.liepin.com/job/{placeholder_suffix}",
        f"http://lpt.liepin.com/job/{placeholder_suffix}",
    }


def _matches_list_snapshot_upgrade(
    *,
    link: ExternalJobLink,
    external_job_title: str,
    metadata: dict[str, Any] | None,
) -> bool:
    if _metadata_value(link.metadata, "identity_source") != LIST_SNAPSHOT_IDENTITY_SOURCE:
        return False
    if not external_job_title:
        return False
    if _trimmed(link.external_job_title) != external_job_title:
        return False

    requested_refresh_time = _metadata_value(metadata, "list_refresh_time")
    if not requested_refresh_time:
        return True
    return _metadata_value(link.metadata, "list_refresh_time") == requested_refresh_time


def _resolve_external_job_url(
    platform: str | None,
    external_job_id: str | None,
    external_job_url: str | None,
    remote_snapshot: dict[str, Any] | None,
) -> str:
    direct_url = _trimmed(external_job_url)
    snapshot_url = _resolve_snapshot_job_url(remote_snapshot)
    if direct_url and not _is_fabricated_liepin_placeholder_url(
        platform=platform,
        external_job_id=external_job_id,
        url=direct_url,
    ):
        return direct_url
    return snapshot_url


def _build_link_view(
    link: ExternalJobLink,
    account: RecruitPlatformAccount | None,
) -> ExternalJobLinkView:
    return ExternalJobLinkView(
        **link.model_dump(),
        account_name=account.account_name if account else "",
        account_status=account.status if account else "disabled",
    )


async def list_job_external_links(job_id: str) -> list[ExternalJobLinkView]:
    """Return active external links enriched with platform account metadata."""
    links_repo = JsonExternalJobLinkRepository(
        get_recruitment_external_job_links_path(),
    )
    accounts_repo = JsonRecruitPlatformAccountRepository(
        get_recruitment_platform_accounts_path(),
    )
    links = await links_repo.list_links_by_job(job_id)
    if not links:
        return []

    accounts = await accounts_repo.list_accounts()
    accounts_by_id = {account.id: account for account in accounts}

    views: list[ExternalJobLinkView] = []
    for link in links:
        if link.status != "active":
            continue
        views.append(
            _build_link_view(link, accounts_by_id.get(link.platform_account_id))
        )

    return views


async def ensure_platform_account(
    *,
    platform: str,
    platform_account_id: str | None = None,
    account_key: str | None = None,
    account_name: str | None = None,
    tenant_key: str | None = None,
    capabilities: list[str] | None = None,
    credential_ref: str | None = None,
    metadata: dict[str, Any] | None = None,
    create_if_missing: bool = True,
) -> RecruitPlatformAccount:
    """Resolve or create a platform account used by external job links."""
    platform_value = _trimmed(platform)
    if not platform_value:
        raise ValueError("平台标识不能为空")

    requested_account_id = _trimmed(platform_account_id)
    requested_account_key = _trimmed(account_key)
    requested_account_name = _trimmed(account_name)
    requested_tenant_key = _trimmed(tenant_key)
    requested_credential_ref = _trimmed(credential_ref)
    requested_capabilities = [
        item.strip()
        for item in (capabilities or [])
        if isinstance(item, str) and item.strip()
    ]
    requested_metadata = dict(metadata or {})

    accounts_repo = JsonRecruitPlatformAccountRepository(
        get_recruitment_platform_accounts_path(),
    )
    accounts_file = await accounts_repo.load()

    account: RecruitPlatformAccount | None = None
    for candidate in accounts_file.accounts:
        if requested_account_id and candidate.id == requested_account_id:
            account = candidate
            break
        if (
            not requested_account_id
            and candidate.platform == platform_value
            and requested_account_key
            and candidate.account_key == requested_account_key
        ):
            account = candidate
            break
        if (
            not requested_account_id
            and not requested_account_key
            and candidate.platform == platform_value
            and requested_account_name
            and candidate.account_name == requested_account_name
        ):
            account = candidate
            break

    if requested_account_id and account is None:
        raise PlatformAccountNotFoundError(
            f"未找到平台账号：{requested_account_id}",
        )

    now = _utcnow()
    if account is None:
        if not create_if_missing:
            raise PlatformAccountNotFoundError("未找到可用的平台账号")
        account = RecruitPlatformAccount(
            platform=platform_value,
            account_key=(
                requested_account_key
                or requested_account_name
                or f"{platform_value}-default"
            ),
            account_name=requested_account_name or requested_account_key,
            tenant_key=requested_tenant_key,
            capabilities=requested_capabilities,
            credential_ref=requested_credential_ref,
            metadata=requested_metadata,
            created_at=now,
            updated_at=now,
        )
        accounts_file.accounts.append(account)
    else:
        if requested_account_name:
            account.account_name = requested_account_name
        if requested_account_key:
            account.account_key = requested_account_key
        if requested_tenant_key:
            account.tenant_key = requested_tenant_key
        if requested_capabilities:
            account.capabilities = requested_capabilities
        if requested_credential_ref:
            account.credential_ref = requested_credential_ref
        if requested_metadata:
            account.metadata.update(requested_metadata)
        account.updated_at = now

    await accounts_repo.save(accounts_file)
    return account


async def upsert_job_external_link(
    *,
    job_id: str,
    platform: str,
    external_job_id: str,
    platform_account_id: str | None = None,
    account_key: str | None = None,
    account_name: str | None = None,
    tenant_key: str | None = None,
    external_job_code: str | None = None,
    external_job_title: str | None = None,
    external_job_url: str | None = None,
    external_status: str | None = None,
    relation_type: str = "linked",
    source_of_truth: str = "external_preferred",
    sync_status: str = "success",
    remote_snapshot: dict[str, Any] | None = None,
    publish_payload_snapshot: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
    capabilities: list[str] | None = None,
    credential_ref: str | None = None,
) -> ExternalJobLinkView:
    """Create or update the mapping between a CoPaw job and an external job."""
    normalized_job_id = _trimmed(job_id)
    normalized_platform = _trimmed(platform)
    normalized_external_job_id = _trimmed(external_job_id)
    normalized_external_job_title = _trimmed(external_job_title)
    if not normalized_job_id:
        raise ValueError("缺少 CoPaw 职位 ID")
    if not normalized_platform:
        raise ValueError("缺少平台标识")
    if not normalized_external_job_id:
        raise ValueError("缺少外部职位 ID")

    job = await get_job(normalized_job_id)
    if job is None:
        raise JobNotFoundError(f"未找到职位：{normalized_job_id}")

    account = await ensure_platform_account(
        platform=normalized_platform,
        platform_account_id=platform_account_id,
        account_key=account_key,
        account_name=account_name,
        tenant_key=tenant_key,
        capabilities=capabilities,
        credential_ref=credential_ref,
        create_if_missing=True,
    )

    links_repo = JsonExternalJobLinkRepository(
        get_recruitment_external_job_links_path(),
    )
    links_file = await links_repo.load()
    now = _utcnow()

    target_link: ExternalJobLink | None = None
    for link in links_file.links:
        if (
            link.job_id == normalized_job_id
            and link.platform == normalized_platform
            and link.platform_account_id == account.id
            and link.external_job_id == normalized_external_job_id
        ):
            target_link = link
            break

    if target_link is None and normalized_external_job_title:
        for link in links_file.links:
            if (
                link.job_id == normalized_job_id
                and link.platform == normalized_platform
                and link.platform_account_id == account.id
                and link.status == "active"
                and _matches_list_snapshot_upgrade(
                    link=link,
                    external_job_title=normalized_external_job_title,
                    metadata=metadata,
                )
            ):
                target_link = link
                break

    for link in links_file.links:
        if (
            link.job_id == normalized_job_id
            and link.platform == normalized_platform
            and link.platform_account_id == account.id
            and link.status == "active"
            and (target_link is None or link.id != target_link.id)
        ):
            raise ExternalJobLinkConflictError(
                "当前 CoPaw 职位已绑定其他企业版职位；如需更换，请先解除旧绑定",
            )

    if target_link is None:
        target_link = ExternalJobLink(
            job_id=job.id,
            platform_account_id=account.id,
            platform=normalized_platform,
            external_job_id=normalized_external_job_id,
            created_at=now,
            updated_at=now,
        )
        links_file.links.append(target_link)

    target_link.external_job_id = normalized_external_job_id
    target_link.external_job_code = _trimmed(external_job_code)
    target_link.external_job_title = normalized_external_job_title
    target_link.external_job_url = _resolve_external_job_url(
        normalized_platform,
        normalized_external_job_id,
        external_job_url,
        remote_snapshot,
    )
    target_link.external_status = _trimmed(external_status)
    target_link.relation_type = relation_type
    target_link.status = "active"
    target_link.source_of_truth = source_of_truth
    target_link.sync_status = sync_status
    target_link.last_pulled_at = now
    if remote_snapshot:
        target_link.remote_snapshot = dict(remote_snapshot)
    if publish_payload_snapshot:
        target_link.publish_payload_snapshot = dict(publish_payload_snapshot)
    if metadata:
        target_link.metadata.update(metadata)
    target_link.updated_at = now

    await links_repo.save(links_file)
    return _build_link_view(target_link, account)


async def delete_job_external_links(job_id: str) -> int:
    """Delete all external job links associated with a CoPaw job."""
    links_repo = JsonExternalJobLinkRepository(
        get_recruitment_external_job_links_path(),
    )
    return await links_repo.delete_links_by_job(job_id)


async def unlink_job_external_link(
    *,
    job_id: str,
    link_id: str,
) -> ExternalJobLinkView:
    """Mark a specific external job link as unlinked."""
    normalized_job_id = _trimmed(job_id)
    normalized_link_id = _trimmed(link_id)
    if not normalized_job_id:
        raise ValueError("缺少 CoPaw 职位 ID")
    if not normalized_link_id:
        raise ValueError("缺少外部关联 ID")

    job = await get_job(normalized_job_id)
    if job is None:
        raise JobNotFoundError(f"未找到职位：{normalized_job_id}")

    links_repo = JsonExternalJobLinkRepository(
        get_recruitment_external_job_links_path(),
    )
    accounts_repo = JsonRecruitPlatformAccountRepository(
        get_recruitment_platform_accounts_path(),
    )
    links_file = await links_repo.load()

    target_link: ExternalJobLink | None = None
    for link in links_file.links:
        if link.id == normalized_link_id and link.job_id == normalized_job_id:
            target_link = link
            break

    if target_link is None:
        raise ExternalJobLinkNotFoundError(
            f"未找到职位关联：{normalized_link_id}",
        )

    target_link.status = "unlinked"
    target_link.updated_at = _utcnow()
    await links_repo.save(links_file)

    account = await accounts_repo.get_account(target_link.platform_account_id)
    return _build_link_view(target_link, account)
