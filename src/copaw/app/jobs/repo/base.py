# -*- coding: utf-8 -*-
"""Repository helpers for minimal recruitment jobs."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from ..models import JobSpec, JobsFile


class BaseJobRepository(ABC):
    """Abstract repository for jobs.json persistence."""

    @property
    @abstractmethod
    def path(self):
        raise NotImplementedError

    @abstractmethod
    async def load(self) -> JobsFile:
        raise NotImplementedError

    @abstractmethod
    async def save(self, jobs_file: JobsFile) -> None:
        raise NotImplementedError

    async def list_jobs(self) -> list[JobSpec]:
        jf = await self.load()
        return jf.jobs

    async def get_job(self, job_id: str) -> Optional[JobSpec]:
        jf = await self.load()
        for job in jf.jobs:
            if job.id == job_id:
                return job
        return None

    async def upsert_job(self, spec: JobSpec) -> None:
        jf = await self.load()
        for index, job in enumerate(jf.jobs):
            if job.id == spec.id:
                jf.jobs[index] = spec
                break
        else:
            jf.jobs.append(spec)
        await self.save(jf)

    async def delete_job(self, job_id: str) -> bool:
        jf = await self.load()
        before = len(jf.jobs)
        jf.jobs = [job for job in jf.jobs if job.id != job_id]
        if len(jf.jobs) == before:
            return False
        await self.save(jf)
        return True
