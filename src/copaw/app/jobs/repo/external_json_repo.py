# -*- coding: utf-8 -*-
"""JSON repositories for external recruitment platform data."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from ..external_models import (
    ExternalJobLink,
    ExternalJobLinksFile,
    RecruitPlatformAccount,
    RecruitPlatformAccountsFile,
)


class _JsonFileStore:
    def __init__(self, path: Path | str):
        if isinstance(path, str):
            path = Path(path)
        self._path = path.expanduser()

    @property
    def path(self) -> Path:
        return self._path

    def _save_payload(self, payload: dict) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        shutil.move(str(tmp_path), str(self._path))


class JsonRecruitPlatformAccountRepository(_JsonFileStore):
    async def load(self) -> RecruitPlatformAccountsFile:
        if not self.path.exists():
            return RecruitPlatformAccountsFile(version=1, accounts=[])
        data = json.loads(self.path.read_text(encoding="utf-8"))
        return RecruitPlatformAccountsFile.model_validate(data)

    async def save(self, accounts_file: RecruitPlatformAccountsFile) -> None:
        self._save_payload(accounts_file.model_dump(mode="json"))

    async def list_accounts(self) -> list[RecruitPlatformAccount]:
        return (await self.load()).accounts

    async def get_account(
        self,
        account_id: str,
    ) -> RecruitPlatformAccount | None:
        for account in (await self.load()).accounts:
            if account.id == account_id:
                return account
        return None


class JsonExternalJobLinkRepository(_JsonFileStore):
    async def load(self) -> ExternalJobLinksFile:
        if not self.path.exists():
            return ExternalJobLinksFile(version=1, links=[])
        data = json.loads(self.path.read_text(encoding="utf-8"))
        return ExternalJobLinksFile.model_validate(data)

    async def save(self, links_file: ExternalJobLinksFile) -> None:
        self._save_payload(links_file.model_dump(mode="json"))

    async def list_links(self) -> list[ExternalJobLink]:
        return (await self.load()).links

    async def list_links_by_job(
        self,
        job_id: str,
    ) -> list[ExternalJobLink]:
        return [
            link
            for link in (await self.load()).links
            if link.job_id == job_id
        ]

    async def delete_links_by_job(self, job_id: str) -> int:
        links_file = await self.load()
        before = len(links_file.links)
        links_file.links = [
            link for link in links_file.links if link.job_id != job_id
        ]
        deleted_count = before - len(links_file.links)
        if deleted_count > 0:
            await self.save(links_file)
        return deleted_count

