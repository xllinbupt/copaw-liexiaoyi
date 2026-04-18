# -*- coding: utf-8 -*-
"""JSON repositories for pipeline storage."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from ..pipeline_models import (
    CandidateProfile,
    CandidatesFile,
    PipelineActivitiesFile,
    PipelineActivity,
    PipelineEntriesFile,
    PipelineEntry,
    PipelineStagesFile,
    PipelineStageDefinition,
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
        tmp_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                dir=self._path.parent,
                prefix=f".{self._path.stem}_",
                suffix=self._path.suffix,
                delete=False,
                encoding="utf-8",
            ) as handle:
                handle.write(
                    json.dumps(
                        payload,
                        ensure_ascii=False,
                        indent=2,
                        sort_keys=True,
                    )
                )
                tmp_path = Path(handle.name)
            tmp_path.replace(self._path)
        finally:
            if tmp_path is not None and tmp_path.exists():
                tmp_path.unlink(missing_ok=True)


class JsonCandidateRepository(_JsonFileStore):
    async def load(self) -> CandidatesFile:
        if not self.path.exists():
            return CandidatesFile(version=1, candidates=[])
        data = json.loads(self.path.read_text(encoding="utf-8"))
        return CandidatesFile.model_validate(data)

    async def save(self, candidates_file: CandidatesFile) -> None:
        self._save_payload(candidates_file.model_dump(mode="json"))

    async def list_candidates(self) -> list[CandidateProfile]:
        return (await self.load()).candidates

    async def get_candidate(self, candidate_id: str) -> CandidateProfile | None:
        for candidate in (await self.load()).candidates:
            if candidate.id == candidate_id:
                return candidate
        return None

    async def find_by_source(
        self,
        source_platform: str,
        source_candidate_key: str,
    ) -> CandidateProfile | None:
        if not source_platform or not source_candidate_key:
            return None
        for candidate in (await self.load()).candidates:
            if (
                candidate.source_platform == source_platform
                and candidate.source_candidate_key == source_candidate_key
            ):
                return candidate
        return None

    async def upsert_candidate(self, candidate: CandidateProfile) -> None:
        candidates_file = await self.load()
        for index, existing in enumerate(candidates_file.candidates):
            if existing.id == candidate.id:
                candidates_file.candidates[index] = candidate
                break
        else:
            candidates_file.candidates.append(candidate)
        await self.save(candidates_file)


class JsonPipelineStageRepository(_JsonFileStore):
    async def load(self) -> PipelineStagesFile:
        if not self.path.exists():
            return PipelineStagesFile(version=1, stages=[])
        data = json.loads(self.path.read_text(encoding="utf-8"))
        return PipelineStagesFile.model_validate(data)

    async def save(self, stages_file: PipelineStagesFile) -> None:
        self._save_payload(stages_file.model_dump(mode="json"))

    async def list_stages(self) -> list[PipelineStageDefinition]:
        return (await self.load()).stages

    async def upsert_stage(self, stage: PipelineStageDefinition) -> None:
        stages_file = await self.load()
        for index, existing in enumerate(stages_file.stages):
            if existing.id == stage.id:
                stages_file.stages[index] = stage
                break
        else:
            stages_file.stages.append(stage)
        await self.save(stages_file)

    async def replace_stages(
        self,
        stages: list[PipelineStageDefinition],
    ) -> None:
        await self.save(PipelineStagesFile(version=1, stages=stages))


class JsonPipelineEntryRepository(_JsonFileStore):
    async def load(self) -> PipelineEntriesFile:
        if not self.path.exists():
            return PipelineEntriesFile(version=1, entries=[])
        data = json.loads(self.path.read_text(encoding="utf-8"))
        return PipelineEntriesFile.model_validate(data)

    async def save(self, entries_file: PipelineEntriesFile) -> None:
        self._save_payload(entries_file.model_dump(mode="json"))

    async def list_entries(self) -> list[PipelineEntry]:
        return (await self.load()).entries

    async def get_entry(self, entry_id: str) -> PipelineEntry | None:
        for entry in (await self.load()).entries:
            if entry.id == entry_id:
                return entry
        return None

    async def list_entries_by_job(self, job_id: str) -> list[PipelineEntry]:
        return [
            entry
            for entry in (await self.load()).entries
            if entry.job_id == job_id
        ]

    async def list_entries_by_candidate(
        self,
        candidate_id: str,
    ) -> list[PipelineEntry]:
        return [
            entry
            for entry in (await self.load()).entries
            if entry.candidate_id == candidate_id
        ]

    async def find_entry(
        self,
        *,
        job_id: str,
        candidate_id: str,
    ) -> PipelineEntry | None:
        for entry in (await self.load()).entries:
            if entry.job_id == job_id and entry.candidate_id == candidate_id:
                return entry
        return None

    async def find_entry_by_source_resume_id(
        self,
        *,
        job_id: str,
        source_resume_id: str,
    ) -> PipelineEntry | None:
        if not source_resume_id:
            return None
        for entry in (await self.load()).entries:
            if (
                entry.job_id == job_id
                and entry.source_resume_id == source_resume_id
            ):
                return entry
        return None

    async def upsert_entry(self, entry: PipelineEntry) -> None:
        entries_file = await self.load()
        for index, existing in enumerate(entries_file.entries):
            if existing.id == entry.id:
                entries_file.entries[index] = entry
                break
        else:
            entries_file.entries.append(entry)
        await self.save(entries_file)

    async def delete_entries_by_job(self, job_id: str) -> list[str]:
        entries_file = await self.load()
        deleted_entry_ids = [
            entry.id
            for entry in entries_file.entries
            if entry.job_id == job_id
        ]
        if not deleted_entry_ids:
            return []
        entries_file.entries = [
            entry
            for entry in entries_file.entries
            if entry.job_id != job_id
        ]
        await self.save(entries_file)
        return deleted_entry_ids


class JsonPipelineActivityRepository(_JsonFileStore):
    async def load(self) -> PipelineActivitiesFile:
        if not self.path.exists():
            return PipelineActivitiesFile(version=1, activities=[])
        data = json.loads(self.path.read_text(encoding="utf-8"))
        return PipelineActivitiesFile.model_validate(data)

    async def save(self, activities_file: PipelineActivitiesFile) -> None:
        self._save_payload(activities_file.model_dump(mode="json"))

    async def list_activities(self) -> list[PipelineActivity]:
        return (await self.load()).activities

    async def append_activity(self, activity: PipelineActivity) -> None:
        activities_file = await self.load()
        activities_file.activities.append(activity)
        await self.save(activities_file)

    async def delete_activities_by_entry_ids(self, entry_ids: list[str]) -> int:
        if not entry_ids:
            return 0
        activities_file = await self.load()
        before = len(activities_file.activities)
        entry_id_set = set(entry_ids)
        activities_file.activities = [
            activity
            for activity in activities_file.activities
            if activity.pipeline_entry_id not in entry_id_set
        ]
        deleted_count = before - len(activities_file.activities)
        if deleted_count > 0:
            await self.save(activities_file)
        return deleted_count
