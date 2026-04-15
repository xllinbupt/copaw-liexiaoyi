#!/usr/bin/env python3
"""Create a Liepin enterprise job via Liexiaoxia sandbox API."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any


DEFAULT_CREATE_EJOB_BASE_URL = "http://open-agent-sandbox20711.sandbox.tongdao.cn"

_COMMON_REQUIRED_FIELDS = (
    "recruitKindCode",
    "ejobTitle",
    "jobCategory",
    "dutyQualify",
    "workRegion",
    "address",
    "eduLevel",
    "recruitCnt",
    "recruitExpireDate",
    "receiveResumeEmails",
)
_SOCIAL_REQUIRED_FIELDS = (
    "workYearLow",
    "workYearHigh",
    "salaryLow",
    "salaryHigh",
    "requireOverseasWorkExp",
    "requireOverseasEduExp",
)
_CAMPUS_REQUIRED_FIELDS = ("salaryLow", "salaryHigh")
_INTERN_REQUIRED_FIELDS = (
    "internshipDaysPerWeek",
    "internshipMonths",
    "salaryLow",
    "salaryHigh",
)
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_SALARY_WITH_UNIT_RE = re.compile(
    r"^\s*(\d+(?:\.\d+)?)\s*([kKwW]|千|万)?\s*$"
)


def _bootstrap_import_path() -> None:
    here = Path(__file__).resolve()
    candidates = [
        Path("/app/src"),
        here.parents[5] if len(here.parents) > 5 else None,
    ]
    for candidate in candidates:
        if candidate and (candidate / "copaw").exists():
            candidate_str = str(candidate)
            if candidate_str not in sys.path:
                sys.path.insert(0, candidate_str)
            return


def _trimmed(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    return ""


def _require_string(payload: dict[str, Any], key: str) -> str:
    value = _trimmed(payload.get(key))
    if not value:
        raise ValueError(f"{key} 不能为空")
    payload[key] = value
    return value


def _require_int(
    payload: dict[str, Any],
    key: str,
    *,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    value = payload.get(key)
    if isinstance(value, bool):
        raise ValueError(f"{key} 必须是整数")
    if isinstance(value, str):
        value = value.strip()
    if value in (None, ""):
        raise ValueError(f"{key} 不能为空")
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{key} 必须是整数") from exc
    if minimum is not None and parsed < minimum:
        raise ValueError(f"{key} 不能小于 {minimum}")
    if maximum is not None and parsed > maximum:
        raise ValueError(f"{key} 不能大于 {maximum}")
    payload[key] = parsed
    return parsed


def _require_salary_int(
    payload: dict[str, Any],
    key: str,
    *,
    minimum: int | None = None,
    allow_unit_suffix: bool = False,
) -> int:
    value = payload.get(key)
    if isinstance(value, bool):
        raise ValueError(f"{key} 必须是整数")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        parsed = int(value)
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            raise ValueError(f"{key} 不能为空")
        if allow_unit_suffix:
            parsed = _parse_salary_amount(text, field_name=key)
        else:
            try:
                parsed = int(text)
            except ValueError as exc:
                raise ValueError(f"{key} 必须是整数") from exc
    else:
        raise ValueError(f"{key} 必须是整数")
    if minimum is not None and parsed < minimum:
        raise ValueError(f"{key} 不能小于 {minimum}")
    payload[key] = parsed
    return parsed


def _parse_salary_amount(raw: str, *, field_name: str) -> int:
    matched = _SALARY_WITH_UNIT_RE.fullmatch(raw)
    if not matched:
        raise ValueError(
            f"{field_name} 必须是整数元，或使用 K/W/千/万 这类可换算单位"
        )

    number_text, unit = matched.groups()
    try:
        base = Decimal(number_text)
    except InvalidOperation as exc:
        raise ValueError(f"{field_name} 不是合法数字") from exc

    multiplier = Decimal("1")
    if unit in {"k", "K", "千"}:
        multiplier = Decimal("1000")
    elif unit in {"w", "W", "万"}:
        multiplier = Decimal("10000")

    amount = base * multiplier
    if amount != amount.to_integral_value():
        raise ValueError(f"{field_name} 换算后必须是整数元")
    return int(amount)


def _optional_int(payload: dict[str, Any], key: str, *, minimum: int | None = None) -> None:
    value = payload.get(key)
    if value in (None, ""):
        payload.pop(key, None)
        return
    parsed = _require_int(payload, key, minimum=minimum)
    payload[key] = parsed


def _require_bool(payload: dict[str, Any], key: str) -> bool:
    value = payload.get(key)
    if isinstance(value, bool):
        payload[key] = value
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "y"}:
            payload[key] = True
            return True
        if lowered in {"false", "0", "no", "n"}:
            payload[key] = False
            return False
    raise ValueError(f"{key} 必须是 true/false")


def _normalize_expire_date(payload: dict[str, Any]) -> str:
    raw = _require_string(payload, "recruitExpireDate")
    candidate = raw.replace("-", "").replace("/", "")
    if not re.fullmatch(r"\d{8}", candidate):
        raise ValueError("recruitExpireDate 必须是 yyyyMMdd")
    try:
        datetime.strptime(candidate, "%Y%m%d")
    except ValueError as exc:
        raise ValueError("recruitExpireDate 不是合法日期") from exc
    payload["recruitExpireDate"] = candidate
    return candidate


def _normalize_emails(payload: dict[str, Any]) -> list[str]:
    raw = _require_string(payload, "receiveResumeEmails")
    emails = [item.strip() for item in raw.split(",") if item.strip()]
    if not emails:
        raise ValueError("receiveResumeEmails 不能为空")
    invalid = [email for email in emails if not _EMAIL_RE.fullmatch(email)]
    if invalid:
        raise ValueError(f"邮箱格式不合法: {', '.join(invalid)}")
    payload["receiveResumeEmails"] = ",".join(emails)
    return emails


def _ensure_required_fields(payload: dict[str, Any], keys: tuple[str, ...]) -> None:
    for key in keys:
        if payload.get(key) in (None, ""):
            raise ValueError(f"{key} 不能为空")


def validate_ejob_info(raw_payload: dict[str, Any]) -> dict[str, Any]:
    payload = dict(raw_payload)
    _ensure_required_fields(payload, _COMMON_REQUIRED_FIELDS)

    recruit_kind = _require_int(payload, "recruitKindCode")
    if recruit_kind not in (0, 1, 2):
        raise ValueError("recruitKindCode 必须是 0、1 或 2")

    for key in (
        "ejobTitle",
        "jobCategory",
        "dutyQualify",
        "workRegion",
        "address",
        "eduLevel",
    ):
        _require_string(payload, key)

    _require_int(payload, "recruitCnt", minimum=1)
    _normalize_expire_date(payload)
    _normalize_emails(payload)

    if recruit_kind == 0:
        _ensure_required_fields(payload, _SOCIAL_REQUIRED_FIELDS)
        work_year_low = _require_int(payload, "workYearLow", minimum=0)
        work_year_high = _require_int(payload, "workYearHigh", minimum=0)
        if work_year_high < work_year_low:
            raise ValueError("workYearHigh 不能小于 workYearLow")
        salary_low = _require_salary_int(
            payload,
            "salaryLow",
            minimum=0,
            allow_unit_suffix=True,
        )
        salary_high = _require_salary_int(
            payload,
            "salaryHigh",
            minimum=0,
            allow_unit_suffix=True,
        )
        if salary_high < salary_low:
            raise ValueError("salaryHigh 不能小于 salaryLow")
        _optional_int(payload, "salaryMonth", minimum=1)
        _require_bool(payload, "requireOverseasWorkExp")
        _require_bool(payload, "requireOverseasEduExp")
    elif recruit_kind == 1:
        _ensure_required_fields(payload, _CAMPUS_REQUIRED_FIELDS)
        salary_low = _require_salary_int(
            payload,
            "salaryLow",
            minimum=0,
            allow_unit_suffix=True,
        )
        salary_high = _require_salary_int(
            payload,
            "salaryHigh",
            minimum=0,
            allow_unit_suffix=True,
        )
        if salary_high < salary_low:
            raise ValueError("salaryHigh 不能小于 salaryLow")
        _optional_int(payload, "salaryMonth", minimum=1)
    else:
        _ensure_required_fields(payload, _INTERN_REQUIRED_FIELDS)
        _require_int(payload, "internshipDaysPerWeek", minimum=1, maximum=5)
        _require_int(payload, "internshipMonths", minimum=1, maximum=12)
        salary_low = _require_salary_int(payload, "salaryLow", minimum=1)
        salary_high = _require_salary_int(payload, "salaryHigh", minimum=1)
        if salary_high < salary_low:
            raise ValueError("salaryHigh 不能小于 salaryLow")
        payload.pop("salaryMonth", None)

    return payload


def _load_ejob_info(args: argparse.Namespace) -> dict[str, Any]:
    if bool(args.ejob_info_json) == bool(args.ejob_info_file):
        raise ValueError("必须且只能提供 --ejob-info-json 或 --ejob-info-file 其中一个")

    if args.ejob_info_json:
        raw_text = args.ejob_info_json
    else:
        raw_text = Path(args.ejob_info_file).read_text(encoding="utf-8")

    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("ejobInfo 必须是合法 JSON 对象") from exc

    if not isinstance(payload, dict):
        raise ValueError("ejobInfo 必须是 JSON 对象")
    return payload


def _parse_create_response(raw_text: str) -> list[int | str]:
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("创建职位返回不是合法 JSON") from exc

    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except json.JSONDecodeError as exc:
            raise ValueError("创建职位返回的字符串不是合法 JSON 数组") from exc

    if not isinstance(parsed, list):
        raise ValueError("创建职位返回不是数组")
    return parsed


_bootstrap_import_path()
os.environ.setdefault("COPAW_LOG_LEVEL", "error")

from copaw.app.jobs.liexiaoxia_client import (  # noqa: E402
    LiexiaoxiaTokenError,
    post_liexiaoxia_json,
    resolve_liexiaoxia_token,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a Liepin enterprise job.")
    parser.add_argument("--base-url", default=DEFAULT_CREATE_EJOB_BASE_URL)
    parser.add_argument(
        "--token",
        default="",
        help="Explicit Liexiaoxia token. Falls back to LIEXIAOXIA_TOKEN.",
    )
    parser.add_argument(
        "--ejob-info-json",
        default="",
        help="Inner CreateEjobInputDto JSON object as a string.",
    )
    parser.add_argument(
        "--ejob-info-file",
        default="",
        help="Path to a JSON file containing the inner CreateEjobInputDto object.",
    )
    args = parser.parse_args()

    try:
        ejob_info = validate_ejob_info(_load_ejob_info(args))
    except (OSError, ValueError) as exc:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": "invalid_request",
                    "message": str(exc),
                },
                ensure_ascii=False,
            )
        )
        return 6

    try:
        token = resolve_liexiaoxia_token(args.token)
    except LiexiaoxiaTokenError as exc:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": "token_error",
                    "message": str(exc),
                },
                ensure_ascii=False,
            )
        )
        return 5

    url = args.base_url.rstrip("/") + "/liexiaoxia/ejob/create_ejob"
    request_payload = {
        "ejobInfo": json.dumps(ejob_info, ensure_ascii=False, separators=(",", ":"))
    }

    try:
        raw_text = post_liexiaoxia_json(url, payload=request_payload, token=token)
        created_job_ids = _parse_create_response(raw_text)
    except urllib.error.HTTPError as exc:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": "http_error",
                    "status_code": exc.code,
                    "message": exc.read().decode("utf-8", errors="replace"),
                },
                ensure_ascii=False,
            )
        )
        return 2
    except ValueError as exc:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": "invalid_response",
                    "message": str(exc),
                    "raw_text": raw_text if "raw_text" in locals() else "",
                },
                ensure_ascii=False,
            )
        )
        return 4
    except Exception as exc:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": "network_error",
                    "message": str(exc),
                },
                ensure_ascii=False,
            )
        )
        return 3

    print(
        json.dumps(
            {
                "success": True,
                "action": "job_create",
                "created_job_ids": created_job_ids,
                "created_job_id": created_job_ids[0] if created_job_ids else None,
                "ejob_info": ejob_info,
                "request_payload": request_payload,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
