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


def test_build_resume_search_payload_with_must_groups_and_filters() -> None:
    module = _load_module()

    payload, warnings = module.build_resume_search_payload(
        page=2,
        page_size=10,
        job_titles=["产品经理"],
        companies=[],
        resume_keywords=["AI", "Agent"],
        current_city=[],
        expected_city=["北京"],
        education=["本科"],
        gender="男",
        full_time_enroll="true",
        must_groups=[
            {"field": "jobTitles", "values": ["产品经理", "AI产品经理"]},
            {"field": "resumeKeywords", "values": ["AI", "Agent"]},
        ],
    )

    assert warnings == []
    bool_obj = json.loads(payload["boolSearchJsonStr"])
    assert bool_obj["currentPage"] == 1
    assert bool_obj["pageSize"] == 10
    assert len(bool_obj["queryChainConditionList"]) == 2
    assert bool_obj["queryChainConditionList"][0]["queryChain"][0]["queryFields"][0][
        "field"
    ] == "JOB_NAME"
    assert bool_obj["queryChainConditionList"][1]["queryChain"][0]["queryFields"][0][
        "fieldName"
    ] == "context_bm25"
    assert bool_obj["rangeFields"] == [
        {
            "fieldName": "want_dqs",
            "filterValues": ["北京"],
            "operator": "INCLUDE",
            "queryType": "FILTER",
            "rangeType": "CLOSE_CLOSE",
            "slop": 0,
            "standard": "TEMPLATE",
        },
        {
            "fieldName": "edu_level",
            "filterValues": ["040"],
            "operator": "INCLUDE",
            "queryType": "FILTER",
            "rangeType": "CLOSE_CLOSE",
            "slop": 0,
            "standard": "TEMPLATE",
        },
        {
            "fieldName": "sex",
            "filterValues": ["1"],
            "operator": "INCLUDE",
            "queryType": "FILTER",
            "rangeType": "CLOSE_CLOSE",
            "slop": 0,
            "standard": "TEMPLATE",
        },
        {
            "fieldName": "edu_level_tzs",
            "filterValues": ["1"],
            "operator": "INCLUDE",
            "queryType": "FILTER",
            "rangeType": "CLOSE_CLOSE",
            "slop": 0,
            "standard": "TEMPLATE",
        },
    ]


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
        return '[{"resIdEncode":"abc123","resName":"张三"}]'

    monkeypatch.setattr(module, "post_liexiaoxia_json", _fake_post)
    monkeypatch.setattr(
        module.sys,
        "argv",
        [
            "search_resume.py",
            "--job-titles",
            '["产品经理"]',
            "--resume-keywords",
            '["AI","Agent"]',
            "--expected-city",
            '["北京"]',
        ],
    )

    exit_code = module.main()
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 0
    assert calls["token"] == "shared-token"
    assert calls["url"].endswith("/liexiaoxia/search_resume_by_token")
    assert output["success"] is True
    assert output["count"] == 1
    assert output["results"][0]["resIdEncode"] == "abc123"
    assert "boolSearchJsonStr" in calls["payload"]


def test_main_rejects_empty_search_groups(monkeypatch, capsys) -> None:
    module = _load_module()
    monkeypatch.setattr(module.sys, "argv", ["search_resume.py"])

    exit_code = module.main()
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 6
    assert output["success"] is False
    assert output["error"] == "invalid_request"
