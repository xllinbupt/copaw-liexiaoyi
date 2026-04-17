import importlib.util
import json
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[3]
    / "src"
    / "copaw"
    / "agents"
    / "skills"
    / "resume_search"
    / "scripts"
    / "search_resume.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "resume_search_script",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_parse_criteria_json_normalizes_object_fields_and_aliases() -> None:
    module = _load_module()

    criteria, warnings = module._parse_criteria_json(
        json.dumps(
            {
                "titlesWithPayload": ["产品经理", "AI产品经理"],
                "contextBm25": ["AI", "Agent"],
                "wantDqs": ["北京"],
                "yearSalary": 40,
                "filterChat": 1,
            },
            ensure_ascii=False,
        )
    )

    assert criteria == {
        "jobTitle": "产品经理 AI产品经理",
        "keyword": "(AI or Agent)",
        "wantDqs": "北京",
        "yearSalLow": 40,
        "filterChat": 1,
    }
    assert warnings == [
        "criteria-json 中的 `titlesWithPayload` 已自动映射为 `jobTitle`。",
        "criteria-json 中的 `contextBm25` 已自动映射为 `keyword`。",
        "criteria-json 中的 `yearSalary` 已自动映射为 `yearSalLow`。",
    ]


def test_build_resume_search_payload_uses_object_bool_search_json_str() -> None:
    module = _load_module()

    payload, warnings = module.build_resume_search_payload(
        {
            "jobTitle": "产品经理 AI产品经理",
            "keyword": "(AI or Agent)",
            "wantDqs": "北京",
        },
        page=2,
        page_size=10,
        filter_chat=1,
        filter_download=2,
        filter_read=1,
    )

    assert warnings == []
    assert json.loads(payload["boolSearchJsonStr"]) == {
        "jobTitle": "产品经理 AI产品经理",
        "keyword": "(AI or Agent)",
        "wantDqs": "北京",
        "curPage": 2,
        "pageSize": 10,
        "filterChat": 1,
        "filterDownload": 2,
        "filterRead": 1,
    }


def test_main_uses_shared_token_helper_and_returns_structured_results(
    monkeypatch, capsys
) -> None:
    module = _load_module()
    calls = {}

    monkeypatch.setattr(
        module,
        "resolve_liexiaoxia_token",
        lambda explicit_token, token_list_url: "shared-token",
    )

    def _fake_post(url, *, payload, token):
        calls["url"] = url
        calls["payload"] = payload
        calls["token"] = token
        return '[{"resIdEncode":"abc123","resName":"张三","brief":"5年AI产品经验，负责Agent与增长方向"}]'

    monkeypatch.setattr(module, "post_liexiaoxia_json", _fake_post)
    monkeypatch.setattr(
        module.sys,
        "argv",
        [
            "search_resume.py",
            "--criteria-json",
            '{"jobTitle":["产品经理"],"keyword":["AI","Agent"],"wantDqs":["北京"]}',
        ],
    )

    exit_code = module.main()
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 0
    assert calls["token"] == "shared-token"
    assert calls["url"].startswith(module.DEFAULT_LIEXIAOXIA_BASE_URL)
    assert calls["url"].endswith("/liexiaoxia/resume/search_resume")
    assert json.loads(calls["payload"]["boolSearchJsonStr"]) == {
        "jobTitle": "产品经理",
        "keyword": "(AI or Agent)",
        "wantDqs": "北京",
        "curPage": 1,
        "pageSize": 20,
    }
    assert output["success"] is True
    assert output["count"] == 1
    assert output["results"][0]["resIdEncode"] == "abc123"
    assert output["results"][0]["brief"] == "5年AI产品经验，负责Agent与增长方向"


def test_main_rejects_empty_search_groups(monkeypatch, capsys) -> None:
    module = _load_module()
    monkeypatch.setattr(module.sys, "argv", ["search_resume.py"])

    exit_code = module.main()
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 6
    assert output["success"] is False
    assert output["error"] == "invalid_request"
