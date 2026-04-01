# -*- coding: utf-8 -*-
"""Tests for chat repository persistence semantics."""
import json
from pathlib import Path

import pytest

from copaw.app.runner.models import ChatSpec
from copaw.app.runner.repo.json_repo import JsonChatRepository


@pytest.mark.asyncio
async def test_upsert_chat_preserves_existing_meta_when_incoming_meta_is_empty(
    tmp_path: Path,
):
    """Later chat updates should not erase existing job binding metadata."""
    repo = JsonChatRepository(tmp_path / "chats.json")
    original = ChatSpec(
        id="chat-1",
        name="New Chat",
        session_id="console:default:1",
        user_id="default",
        channel="console",
        meta={
            "job_id": "job-1",
            "job_name": "AI 产品经理",
            "job": {
                "id": "job-1",
                "name": "AI 产品经理",
            },
        },
    )
    await repo.upsert_chat(original)

    stale_update = ChatSpec(
        id="chat-1",
        name="New Chat",
        session_id="console:default:1",
        user_id="default",
        channel="console",
        meta={},
    )
    await repo.upsert_chat(stale_update)

    payload = json.loads((tmp_path / "chats.json").read_text(encoding="utf-8"))
    [chat] = payload["chats"]
    assert chat["meta"]["job_id"] == "job-1"
    assert chat["meta"]["job_name"] == "AI 产品经理"
    assert chat["meta"]["job"]["id"] == "job-1"
