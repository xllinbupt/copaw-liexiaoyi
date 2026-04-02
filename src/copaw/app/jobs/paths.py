# -*- coding: utf-8 -*-
"""Path helpers for recruitment job and pipeline storage."""
from __future__ import annotations

from pathlib import Path

from ...constant import WORKING_DIR

GLOBAL_RECRUITMENT_JOBS_FILE = "recruitment_jobs.json"
PIPELINE_CANDIDATES_FILE = "recruitment_candidates.json"
PIPELINE_ENTRIES_FILE = "recruitment_pipeline_entries.json"
PIPELINE_STAGES_FILE = "recruitment_pipeline_stages.json"
PIPELINE_ACTIVITIES_FILE = "recruitment_pipeline_activities.json"


def get_recruitment_jobs_path() -> Path:
    """Return dedicated storage for global recruitment jobs."""
    return (WORKING_DIR / GLOBAL_RECRUITMENT_JOBS_FILE).expanduser()


def get_pipeline_candidates_path() -> Path:
    return (WORKING_DIR / PIPELINE_CANDIDATES_FILE).expanduser()


def get_pipeline_entries_path() -> Path:
    return (WORKING_DIR / PIPELINE_ENTRIES_FILE).expanduser()


def get_pipeline_stages_path() -> Path:
    return (WORKING_DIR / PIPELINE_STAGES_FILE).expanduser()


def get_pipeline_activities_path() -> Path:
    return (WORKING_DIR / PIPELINE_ACTIVITIES_FILE).expanduser()
