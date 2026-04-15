from copaw.app.jobs.liexiaoxia_client import (
    LiexiaoxiaTokenError,
    extract_liexiaoxia_token,
    resolve_liexiaoxia_token,
)


def test_extract_liexiaoxia_token_from_plain_text() -> None:
    assert extract_liexiaoxia_token("abcDEF123._-token") == "abcDEF123._-token"


def test_extract_liexiaoxia_token_from_nested_json() -> None:
    raw = """
    {
      "data": {
        "list": [
          {"name": "默认", "accessToken": "abcDEF123456"}
        ]
      }
    }
    """
    assert extract_liexiaoxia_token(raw) == "abcDEF123456"


def test_extract_liexiaoxia_token_rejects_html() -> None:
    assert extract_liexiaoxia_token("<html><body>login</body></html>") is None


def test_resolve_liexiaoxia_token_prefers_explicit_token(monkeypatch) -> None:
    monkeypatch.setenv("LIEXIAOXIA_TOKEN", "env-token")
    assert (
        resolve_liexiaoxia_token(
            "cli-token",
            token_list_url="",
        )
        == "cli-token"
    )


def test_resolve_liexiaoxia_token_uses_env(monkeypatch) -> None:
    monkeypatch.setenv("LIEXIAOXIA_TOKEN", "env-token")
    assert resolve_liexiaoxia_token("", token_list_url="") == "env-token"


def test_resolve_liexiaoxia_token_requires_user_provided_token(monkeypatch) -> None:
    monkeypatch.delenv("LIEXIAOXIA_TOKEN", raising=False)

    try:
        resolve_liexiaoxia_token("")
    except LiexiaoxiaTokenError as exc:
        message = str(exc)
    else:
        raise AssertionError("Expected LiexiaoxiaTokenError")

    assert "LIEXIAOXIA_TOKEN" in message
    assert "persionaccesstoken/list" in message
