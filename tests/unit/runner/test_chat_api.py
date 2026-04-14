# -*- coding: utf-8 -*-
"""Tests for chat API orphan-session handling."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from copaw.app.runner import api as chat_api
from copaw.app.runner.models import ChatSpec


class _FakeManager:
    def __init__(self, chats: list[ChatSpec]):
        self._chats = {chat.id: chat for chat in chats}
        self.deleted_chat_ids: list[str] = []

    async def list_chats(self, user_id=None, channel=None):
        chats = list(self._chats.values())
        if user_id is not None:
            chats = [chat for chat in chats if chat.user_id == user_id]
        if channel is not None:
            chats = [chat for chat in chats if chat.channel == channel]
        return chats

    async def get_chat(self, chat_id: str):
        return self._chats.get(chat_id)

    async def delete_chats(self, chat_ids: list[str]):
        self.deleted_chat_ids.extend(chat_ids)
        for chat_id in chat_ids:
            self._chats.pop(chat_id, None)
        return True


class _FakeSession:
    def __init__(self, existing_sessions: set[tuple[str, str]], states: dict | None = None):
        self._existing_sessions = existing_sessions
        self._states = states or {}

    def session_state_exists(self, session_id: str, user_id: str = "") -> bool:
        return (session_id, user_id) in self._existing_sessions

    async def get_session_state_dict(self, session_id: str, user_id: str = "", allow_not_exist: bool = True):
        return self._states.get((session_id, user_id), {})


class _FakeTaskTracker:
    async def get_status(self, chat_id: str) -> str:
        return "idle"


class _FakeWorkspace:
    def __init__(self):
        self.task_tracker = _FakeTaskTracker()


@pytest.mark.asyncio
async def test_list_chats_filters_orphaned_history_chat() -> None:
    now = datetime.now(timezone.utc)
    orphan = ChatSpec(
        id="chat-orphan",
        name="帮我找 AI 产品经理",
        session_id="console:default:1",
        user_id="default",
        channel="console",
        created_at=now - timedelta(days=1),
        updated_at=now,
    )
    manager = _FakeManager([orphan])
    session = _FakeSession(existing_sessions=set())
    workspace = _FakeWorkspace()

    chats = await chat_api.list_chats(
        user_id=None,
        channel=None,
        mgr=manager,
        session=session,
        workspace=workspace,
    )

    assert chats == []
    assert manager.deleted_chat_ids == ["chat-orphan"]


@pytest.mark.asyncio
async def test_list_chats_keeps_pristine_new_chat_without_session() -> None:
    now = datetime.now(timezone.utc)
    pristine = ChatSpec(
        id="chat-new",
        name="New Chat",
        session_id="console:default:2",
        user_id="default",
        channel="console",
        created_at=now,
        updated_at=now,
        meta={},
    )
    manager = _FakeManager([pristine])
    session = _FakeSession(existing_sessions=set())
    workspace = _FakeWorkspace()

    chats = await chat_api.list_chats(
        user_id=None,
        channel=None,
        mgr=manager,
        session=session,
        workspace=workspace,
    )

    assert len(chats) == 1
    assert chats[0].id == "chat-new"
    assert manager.deleted_chat_ids == []


@pytest.mark.asyncio
async def test_list_chats_keeps_new_job_context_chat_without_session() -> None:
    now = datetime.now(timezone.utc)
    pristine = ChatSpec(
        id="chat-job-new",
        name="New Chat",
        session_id="console:default:job",
        user_id="default",
        channel="console",
        created_at=now,
        updated_at=now + timedelta(seconds=1),
        meta={
            "job_id": "job-1",
            "job_name": "Agent 产品经理",
        },
    )
    manager = _FakeManager([pristine])
    session = _FakeSession(existing_sessions=set())
    workspace = _FakeWorkspace()

    chats = await chat_api.list_chats(
        user_id=None,
        channel=None,
        mgr=manager,
        session=session,
        workspace=workspace,
    )

    assert len(chats) == 1
    assert chats[0].id == "chat-job-new"
    assert manager.deleted_chat_ids == []


@pytest.mark.asyncio
async def test_get_chat_raises_404_for_orphaned_history_chat() -> None:
    now = datetime.now(timezone.utc)
    orphan = ChatSpec(
        id="chat-orphan",
        name="帮我找 AI 产品经理",
        session_id="console:default:3",
        user_id="default",
        channel="console",
        created_at=now - timedelta(days=2),
        updated_at=now,
    )
    manager = _FakeManager([orphan])
    session = _FakeSession(existing_sessions=set())
    workspace = _FakeWorkspace()

    with pytest.raises(HTTPException, match="Chat content missing"):
        await chat_api.get_chat(
            chat_id="chat-orphan",
            mgr=manager,
            session=session,
            workspace=workspace,
        )

    assert manager.deleted_chat_ids == ["chat-orphan"]
