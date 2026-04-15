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
    / "list_ejobs.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "liepin_list_ejobs_script",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_main_calls_new_enterprise_job_list_endpoint(monkeypatch, capsys) -> None:
    module = _load_module()
    calls = {}

    monkeypatch.setattr(
        module,
        "resolve_liexiaoxia_token",
        lambda explicit_token: "shared-token",
    )

    def _fake_post(url, *, payload, token):
        calls["url"] = url
        calls["payload"] = payload
        calls["token"] = token
        return '[{"ejobId":123,"ejobTitle":"AI 产品经理"}]'

    monkeypatch.setattr(module, "post_liexiaoxia_json", _fake_post)
    monkeypatch.setattr(module.sys, "argv", ["list_ejobs.py"])

    exit_code = module.main()
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 0
    assert calls["token"] == "shared-token"
    assert calls["payload"] == {"ejobId": 0}
    assert calls["url"].endswith("/liexiaoxia/ejob/get_ejob_list")
    assert output["success"] is True
    assert output["count"] == 1
    assert output["jobs"][0]["copawExternalJobId"] == "123"
