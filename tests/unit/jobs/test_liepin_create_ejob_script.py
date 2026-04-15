import importlib.util
import json
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[3]
    / "src"
    / "copaw"
    / "agents"
    / "skills"
    / "liepin_job_manage"
    / "scripts"
    / "create_ejob.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "liepin_create_ejob_script",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_validate_ejob_info_normalizes_social_job_payload() -> None:
    module = _load_module()

    payload = module.validate_ejob_info(
        {
            "recruitKindCode": "0",
            "ejobTitle": "AI 产品经理",
            "jobCategory": "产品经理",
            "dutyQualify": "负责 AIGC 产品规划",
            "workRegion": "北京,海淀区",
            "address": "中关村软件园",
            "eduLevel": "本科",
            "recruitCnt": "2",
            "recruitExpireDate": "2026-06-30",
            "receiveResumeEmails": "a@example.com, b@example.com ",
            "workYearLow": "5",
            "workYearHigh": "8",
            "salaryLow": "30000",
            "salaryHigh": "50000",
            "salaryMonth": "14",
            "requireOverseasWorkExp": "false",
            "requireOverseasEduExp": "true",
        }
    )

    assert payload["recruitKindCode"] == 0
    assert payload["recruitCnt"] == 2
    assert payload["recruitExpireDate"] == "20260630"
    assert payload["receiveResumeEmails"] == "a@example.com,b@example.com"
    assert payload["salaryMonth"] == 14
    assert payload["requireOverseasWorkExp"] is False
    assert payload["requireOverseasEduExp"] is True


def test_main_posts_stringified_ejob_info_and_returns_ids(monkeypatch, capsys) -> None:
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
        return '"[123456789]"'

    monkeypatch.setattr(module, "post_liexiaoxia_json", _fake_post)
    monkeypatch.setattr(
        module.sys,
        "argv",
        [
            "create_ejob.py",
            "--ejob-info-json",
            json.dumps(
                {
                    "recruitKindCode": 1,
                    "ejobTitle": "校招产品经理",
                    "jobCategory": "产品经理",
                    "dutyQualify": "负责校园招聘产品方向",
                    "workRegion": "上海,浦东新区",
                    "address": "张江高科技园区",
                    "eduLevel": "本科",
                    "recruitCnt": 3,
                    "recruitExpireDate": "20260731",
                    "receiveResumeEmails": "campus@example.com",
                    "salaryLow": 15000,
                    "salaryHigh": 25000,
                    "salaryMonth": 12,
                },
                ensure_ascii=False,
            ),
        ],
    )

    exit_code = module.main()
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 0
    assert calls["token"] == "shared-token"
    assert calls["url"].endswith("/liexiaoxia/ejob/create_ejob")
    assert json.loads(calls["payload"]["ejobInfo"])["ejobTitle"] == "校招产品经理"
    assert output["success"] is True
    assert output["created_job_id"] == 123456789
    assert output["created_job_ids"] == [123456789]


def test_main_rejects_invalid_internship_days(monkeypatch, capsys) -> None:
    module = _load_module()
    monkeypatch.setattr(
        module.sys,
        "argv",
        [
            "create_ejob.py",
            "--ejob-info-json",
            json.dumps(
                {
                    "recruitKindCode": 2,
                    "ejobTitle": "产品实习生",
                    "jobCategory": "产品经理",
                    "dutyQualify": "负责产品支持",
                    "workRegion": "北京,朝阳区",
                    "address": "望京 SOHO",
                    "eduLevel": "本科",
                    "recruitCnt": 1,
                    "recruitExpireDate": "20260901",
                    "receiveResumeEmails": "intern@example.com",
                    "internshipDaysPerWeek": 6,
                    "internshipMonths": 3,
                    "salaryLow": 200,
                    "salaryHigh": 300,
                },
                ensure_ascii=False,
            ),
        ],
    )

    exit_code = module.main()
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 6
    assert output["success"] is False
    assert output["error"] == "invalid_request"
    assert "internshipDaysPerWeek" in output["message"]
