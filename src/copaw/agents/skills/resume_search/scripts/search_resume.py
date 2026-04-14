#!/usr/bin/env python3
"""Search resumes from the Liexiaoxia sandbox API."""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
from pathlib import Path
from typing import Any


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


_bootstrap_import_path()
os.environ.setdefault("COPAW_LOG_LEVEL", "error")

DEFAULT_LIEXIAOXIA_BASE_URL = "http://open-techarea-sandbox20620.sandbox.tongdao.cn"
LiexiaoxiaTokenError = RuntimeError
post_liexiaoxia_json = None
resolve_liexiaoxia_token = None


def _load_liexiaoxia_client() -> tuple[Any, Any, Any]:
    from copaw.app.jobs.liexiaoxia_client import (  # noqa: WPS433
        LiexiaoxiaTokenError,
        post_liexiaoxia_json,
        resolve_liexiaoxia_token,
    )

    return LiexiaoxiaTokenError, post_liexiaoxia_json, resolve_liexiaoxia_token


FIELD_SPECS: dict[str, dict[str, Any]] = {
    "jobTitles": {
        "field_key": "field",
        "field_name": "JOB_NAME",
        "slop": 0,
        "standard": "EXTEND",
    },
    "companies": {
        "field_key": "field",
        "field_name": "COMP_NAME",
        "slop": 0,
        "standard": "EXTEND",
    },
    "resumeKeywords": {
        "field_key": "fieldName",
        "field_name": "context_bm25",
        "slop": 10,
        "standard": "TEMPLATE",
    },
}

EDUCATION_CODE_MAP = {
    "博士": "010",
    "mba": "020",
    "emba": "020",
    "硕士": "030",
    "研究生": "030",
    "本科": "040",
    "大专": "050",
}

GENDER_CODE_MAP = {
    "女": "0",
    "female": "0",
    "f": "0",
    "男": "1",
    "male": "1",
    "m": "1",
    "不限": "9",
    "unknown": "9",
    "any": "9",
}


SUPPORTED_PROPERTIES: dict[str, dict[str, Any]] = {
    "sex": {"multi": False},
    "resLanguage": {"multi": False},
    "marriage": {"multi": False},
    "dqs": {"multi": True},
    "wantDqs": {"multi": True},
    "houseHolds": {"multi": True},
    "ageLow": {"multi": False},
    "ageHigh": {"multi": False},
    "workYearLow": {"multi": False},
    "workYearHigh": {"multi": False},
    "yearSalary": {"multi": False},
    "wantYearSalLow": {"multi": False},
    "wantYearSalHigh": {"multi": False},
    "graduationYear": {"multi": True},
    "languageContents": {"multi": True},
    "schools": {"multi": True},
    "specials": {"multi": True},
    "eduLevel": {"multi": True},
    "schoolDqs": {"multi": True},
    "eduLevelTzs": {"multi": True},
    "abroadExp": {"multi": False},
    "abroadEdu": {"multi": False},
    "abroad": {"multi": False},
    "manageExp": {"multi": False},
    "compsNormalized": {"multi": True},
    "titlesWithPayload": {"multi": True},
    "contextBm25": {"multi": True},
    "resTagList": {"multi": True},
}

VALID_BOOL_SEARCH_VALUES = {"AND", "OR", "NOT"}


def parse_list_argument(raw: str) -> list[str]:
    text = raw.strip()
    if not text:
        return []
    if text.startswith("["):
        parsed = json.loads(text)
        if not isinstance(parsed, list):
            raise ValueError("列表参数必须是 JSON 数组")
        return _normalize_string_list(parsed)
    parts = [part.strip() for part in text.split(",")]
    return _normalize_string_list(parts)


def _normalize_string_list(values: list[Any]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for item in values:
        text = item.strip() if isinstance(item, str) else str(item).strip()
        if not text or text in seen:
            continue
        normalized.append(text)
        seen.add(text)
    return normalized


def _normalize_scalar(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value).strip()


def _normalize_bool_search_value(value: str) -> str:
    normalized = value.strip().upper()
    if normalized not in VALID_BOOL_SEARCH_VALUES:
        raise ValueError("boolSearchValue 只能是 AND / OR / NOT")
    return normalized


def _build_phrase_fields(field_name: str, values: list[str]) -> list[dict[str, Any]]:
    if field_name not in FIELD_SPECS:
        raise ValueError(f"不支持的 must group 字段: {field_name}")
    if not values:
        raise ValueError("must group 的 values 不能为空")
    spec = FIELD_SPECS[field_name]
    query_fields: list[dict[str, Any]] = []
    for index, value in enumerate(_normalize_string_list(values)):
        query_field: dict[str, Any] = {
            spec["field_key"]: spec["field_name"],
            "operator": "INCLUDE",
            "queryType": "PHRASE",
            "rangeType": "CLOSE_CLOSE",
            "slop": spec["slop"],
            "standard": spec["standard"],
            "value": value,
        }
        if index > 0:
            query_field["logicalOperator"] = "OR"
        query_fields.append(query_field)
    return query_fields


def _build_query_chain(field_name: str, values: list[str]) -> dict[str, Any]:
    return {
        "queryChain": [
            {
                "logicalOperator": "AND",
                "matchOperator": "INCLUDE",
                "queryChains": [],
                "queryFields": _build_phrase_fields(field_name, values),
            }
        ]
    }


def _append_filter(
    range_fields: list[dict[str, Any]],
    *,
    field_name: str,
    values: list[str],
) -> None:
    normalized = _normalize_string_list(values)
    if not normalized:
        return
    range_fields.append(
        {
            "fieldName": field_name,
            "filterValues": normalized,
            "operator": "INCLUDE",
            "queryType": "FILTER",
            "rangeType": "CLOSE_CLOSE",
            "slop": 0,
            "standard": "TEMPLATE",
        }
    )


def _looks_like_context_expression(text: str) -> bool:
    normalized = text.lower()
    return "(" in text or ")" in text or " and " in normalized or " or " in normalized


def _build_criterion(
    property_name: str,
    value: str,
    *,
    bool_search_value: str | None = None,
) -> dict[str, str]:
    if property_name not in SUPPORTED_PROPERTIES:
        raise ValueError(f"不支持的 propertyName: {property_name}")

    normalized_value = _normalize_scalar(value)
    if not normalized_value:
        raise ValueError(f"{property_name} 的 value 不能为空")

    criterion = {
        "propertyName": property_name,
        "value": normalized_value,
    }

    if bool_search_value:
        criterion["boolSearchValue"] = _normalize_bool_search_value(bool_search_value)
        return criterion

    spec = SUPPORTED_PROPERTIES[property_name]
    if spec["multi"] and property_name != "contextBm25":
        criterion["boolSearchValue"] = "OR"
    elif spec["multi"] and property_name == "contextBm25" and "," in normalized_value:
        criterion["boolSearchValue"] = "OR"
    elif spec["multi"] and property_name == "contextBm25" and not _looks_like_context_expression(normalized_value):
        criterion["boolSearchValue"] = "OR"

    return criterion


def _criteria_payload(criteria: list[dict[str, str]]) -> dict[str, str]:
    if not criteria:
        raise ValueError("搜索请求至少要包含一个检索条件")
    return {
        "boolSearchJsonStr": json.dumps(criteria, ensure_ascii=False, separators=(",", ":"))
    }


def _parse_criteria_json(raw: str) -> list[dict[str, str]]:
    text = raw.strip()
    if not text:
        return []

    parsed = json.loads(text)
    if not isinstance(parsed, list):
        raise ValueError("criteria-json 必须是 JSON 数组")

    criteria: list[dict[str, str]] = []
    for item in parsed:
        if not isinstance(item, dict):
            raise ValueError("criteria-json 的每一项都必须是对象")

        property_name = _normalize_scalar(item.get("propertyName"))
        value = item.get("value")
        bool_search_value = item.get("boolSearchValue")

        if not property_name:
            raise ValueError("criteria-json 中缺少 propertyName")

        criteria.append(
            _build_criterion(
                property_name,
                _normalize_scalar(value),
                bool_search_value=_normalize_scalar(bool_search_value) or None,
            )
        )
    return criteria


def _parse_legacy_must_groups(raw: str) -> list[dict[str, Any]]:
    text = raw.strip()
    if not text:
        return []
    parsed = json.loads(text)
    if not isinstance(parsed, list):
        raise ValueError("must-groups 必须是 JSON 数组")

    groups: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            raise ValueError("must-groups 的每一项都必须是对象")
        field_name = _normalize_scalar(item.get("field"))
        values = item.get("values")
        if not field_name:
            raise ValueError("must-groups 中缺少 field")
        if not isinstance(values, list):
            raise ValueError("must-groups.values 必须是数组")
        groups.append({"field": field_name, "values": _normalize_string_list(values)})
    return groups


def build_resume_search_payload(
    *,
    page: int,
    page_size: int,
    job_titles: list[str],
    companies: list[str],
    resume_keywords: list[str],
    current_city: list[str],
    expected_city: list[str],
    education: list[str],
    gender: str,
    full_time_enroll: str,
    must_groups: list[dict[str, Any]],
) -> tuple[dict[str, Any], list[str]]:
    query_groups: list[dict[str, Any]] = []
    warnings: list[str] = []

    if must_groups:
        for group in must_groups:
            query_groups.append(_build_query_chain(group["field"], group["values"]))
    else:
        for field_name, values in (
            ("jobTitles", job_titles),
            ("companies", companies),
            ("resumeKeywords", resume_keywords),
        ):
            if values:
                query_groups.append(_build_query_chain(field_name, values))

    if not query_groups:
        raise ValueError("搜索请求至少要包含一个关键词组，通常应至少提供 jobTitles")

    has_job_title_group = any(
        group["field"] == "jobTitles" for group in must_groups
    ) or bool(job_titles)
    if not has_job_title_group:
        warnings.append("当前请求没有 jobTitles，召回和稳定性可能较差。")

    range_fields: list[dict[str, Any]] = []
    city_filters = expected_city or current_city
    _append_filter(range_fields, field_name="want_dqs", values=city_filters)

    education_codes = [
        EDUCATION_CODE_MAP[item.strip().lower()]
        for item in education
        if item.strip().lower() in EDUCATION_CODE_MAP
    ]
    if education and not education_codes:
        warnings.append("education 目前只支持 博士 / 硕士 / 本科 / 大专 / MBA / EMBA。")
    _append_filter(range_fields, field_name="edu_level", values=education_codes)

    normalized_gender = gender.strip().lower()
    if normalized_gender:
        gender_code = GENDER_CODE_MAP.get(normalized_gender)
        if gender_code is None:
            warnings.append("gender 目前只支持 男 / 女 / 不限。")
        elif gender_code != "9":
            _append_filter(range_fields, field_name="sex", values=[gender_code])

    normalized_full_time = full_time_enroll.strip().lower()
    if normalized_full_time in {"true", "1", "yes", "y", "统招"}:
        _append_filter(range_fields, field_name="edu_level_tzs", values=["1"])
    elif normalized_full_time in {"false", "0", "no", "n", "不限", ""}:
        pass
    elif normalized_full_time:
        warnings.append("full_time_enroll 目前只支持 true / false。")

    bool_obj = {
        "currentPage": max(page - 1, 0),
        "pageSize": page_size,
        "searcherId": 0,
        "filterFields": [],
        "groupSortFields": [],
        "keywordCondition": {"synonym": True},
        "logCondition": {},
        "multiFields": [],
        "phraseFields": [],
        "queryChainConditionList": query_groups,
        "rangeFields": range_fields,
        "shieldCondition": {},
        "sortChainCondition": {"sortChain": []},
        "sortFields": [],
        "tripartite": {},
    }
    return {"boolSearchJsonStr": json.dumps(bool_obj, ensure_ascii=False)}, warnings


def _append_multi_criterion(
    criteria: list[dict[str, str]],
    *,
    property_name: str,
    values: list[str],
    bool_search_value: str = "OR",
) -> None:
    normalized = _normalize_string_list(values)
    if not normalized:
        return
    criteria.append(
        _build_criterion(
            property_name,
            ",".join(normalized),
            bool_search_value=bool_search_value,
        )
    )


def _append_single_criterion(
    criteria: list[dict[str, str]],
    *,
    property_name: str,
    value: str,
) -> None:
    normalized = _normalize_scalar(value)
    if not normalized:
        return
    criteria.append(_build_criterion(property_name, normalized))


def _append_numeric_criterion(
    criteria: list[dict[str, str]],
    *,
    property_name: str,
    value: int | None,
) -> None:
    if value is None:
        return
    criteria.append(_build_criterion(property_name, str(value)))


def build_legacy_resume_search_payload(args: argparse.Namespace) -> tuple[dict[str, str], list[str]]:
    criteria: list[dict[str, str]] = []
    warnings: list[str] = []

    _append_multi_criterion(
        criteria,
        property_name="titlesWithPayload",
        values=parse_list_argument(args.job_titles),
    )
    _append_multi_criterion(
        criteria,
        property_name="compsNormalized",
        values=parse_list_argument(args.companies),
    )
    _append_multi_criterion(
        criteria,
        property_name="contextBm25",
        values=parse_list_argument(args.resume_keywords),
    )
    _append_multi_criterion(
        criteria,
        property_name="dqs",
        values=parse_list_argument(args.current_city),
    )
    _append_multi_criterion(
        criteria,
        property_name="wantDqs",
        values=parse_list_argument(args.expected_city),
    )
    _append_multi_criterion(
        criteria,
        property_name="eduLevel",
        values=parse_list_argument(args.education),
    )
    _append_multi_criterion(
        criteria,
        property_name="languageContents",
        values=parse_list_argument(args.languages),
    )

    gender = _normalize_scalar(args.gender)
    if gender and gender != "不限":
        _append_single_criterion(criteria, property_name="sex", value=gender)

    _append_numeric_criterion(criteria, property_name="ageLow", value=args.age_low)
    _append_numeric_criterion(criteria, property_name="ageHigh", value=args.age_high)
    _append_numeric_criterion(criteria, property_name="workYearLow", value=args.work_year_low)
    _append_numeric_criterion(criteria, property_name="workYearHigh", value=args.work_year_high)

    full_time_enroll = _normalize_scalar(args.full_time_enroll).lower()
    if full_time_enroll in {"true", "1", "yes", "y", "统招"}:
        education_values = parse_list_argument(args.education)
        if education_values:
            _append_multi_criterion(
                criteria,
                property_name="eduLevelTzs",
                values=education_values,
            )
        else:
            warnings.append("full-time-enroll 已开启，但未提供 education，无法自动推导 eduLevelTzs。")
    elif full_time_enroll not in {"", "false", "0", "no", "n", "不限"}:
        warnings.append("full-time-enroll 旧参数只支持 true / false；更复杂的统招条件请改用 --criteria-json。")

    must_groups = _parse_legacy_must_groups(args.must_groups)
    if must_groups:
        field_map = {
            "jobTitles": "titlesWithPayload",
            "companies": "compsNormalized",
            "resumeKeywords": "contextBm25",
        }
        seen_fields: set[str] = set()
        for group in must_groups:
            field_name = group["field"]
            mapped = field_map.get(field_name)
            if not mapped:
                raise ValueError(f"must-groups 暂不支持字段: {field_name}")
            if field_name in seen_fields:
                raise ValueError(
                    "must-groups 出现了重复字段；新版协议无法无损表达旧的多篮子逻辑，请改用 --criteria-json 或 --bool-search-json-str。"
                )
            seen_fields.add(field_name)
            _append_multi_criterion(
                criteria,
                property_name=mapped,
                values=group["values"],
            )
        warnings.append("must-groups 仅做兼容映射；如需表达复杂 AND/OR 组合，请优先使用 --criteria-json。")

    if args.page != 1 or args.page_size != 20:
        warnings.append("新版协议下 page/page-size 不再写入 boolSearchJsonStr，当前由服务端决定返回范围。")

    return _criteria_payload(criteria), warnings


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Search resumes through the Liexiaoxia sandbox API.",
    )
    parser.add_argument("--base-url", default=DEFAULT_LIEXIAOXIA_BASE_URL)
    parser.add_argument(
        "--token",
        default="",
        help="Explicit Liexiaoxia token. Falls back to LIEXIAOXIA_TOKEN.",
    )
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--page-size", type=int, default=20)

    # Preferred new input.
    parser.add_argument(
        "--criteria-json",
        default="",
        help="JSON array of {propertyName, value, boolSearchValue?}.",
    )
    parser.add_argument(
        "--bool-search-json-str",
        default="",
        help="Use an explicit boolSearchJsonStr instead of building one from CLI fields.",
    )
    parser.add_argument(
        "--print-payload-only",
        action="store_true",
        help="Print the assembled request payload and exit without calling the API.",
    )

    # Backward-compatible legacy fields.
    parser.add_argument("--job-titles", default="[]")
    parser.add_argument("--companies", default="[]")
    parser.add_argument("--resume-keywords", default="[]")
    parser.add_argument("--current-city", default="[]")
    parser.add_argument("--expected-city", default="[]")
    parser.add_argument("--education", default="[]")
    parser.add_argument("--languages", default="[]")
    parser.add_argument("--gender", default="不限")
    parser.add_argument("--full-time-enroll", default="")
    parser.add_argument("--age-low", type=int, default=None)
    parser.add_argument("--age-high", type=int, default=None)
    parser.add_argument("--work-year-low", type=int, default=None)
    parser.add_argument("--work-year-high", type=int, default=None)
    parser.add_argument("--must-groups", default="[]")
    args = parser.parse_args()

    if args.page < 1 or args.page_size < 1:
        output = {
            "success": False,
            "error": "invalid_request",
            "message": "page 和 page-size 都必须是正整数。",
        }
        print(json.dumps(output, ensure_ascii=False))
        return 6

    try:
        warnings: list[str] = []
        if args.bool_search_json_str.strip():
            payload = {"boolSearchJsonStr": args.bool_search_json_str.strip()}
        elif args.criteria_json.strip():
            payload = _criteria_payload(_parse_criteria_json(args.criteria_json))
        else:
            payload, warnings = build_legacy_resume_search_payload(args)
    except (ValueError, json.JSONDecodeError) as exc:
        output = {
            "success": False,
            "error": "invalid_request",
            "message": str(exc),
        }
        print(json.dumps(output, ensure_ascii=False))
        return 6

    if args.print_payload_only:
        output = {
            "success": True,
            "action": "resume_search_payload_preview",
            "request_payload": payload,
            "warnings": warnings,
        }
        print(json.dumps(output, ensure_ascii=False))
        return 0

    url = args.base_url.rstrip("/") + "/liexiaoxia/search_resume_by_token"
    token_error_cls = LiexiaoxiaTokenError
    token_resolver = resolve_liexiaoxia_token
    post_json = post_liexiaoxia_json
    if not callable(token_resolver) or not callable(post_json):
        try:
            (
                token_error_cls,
                post_json,
                token_resolver,
            ) = _load_liexiaoxia_client()
        except Exception as exc:
            output = {
                "success": False,
                "error": "missing_dependency",
                "message": f"无法加载猎小侠客户端依赖: {exc}",
                "request_payload": payload,
                "warnings": warnings,
            }
            print(json.dumps(output, ensure_ascii=False))
            return 7

    try:
        token = token_resolver(args.token, token_list_url="")
    except token_error_cls as exc:
        output = {
            "success": False,
            "error": "token_error",
            "message": (
                f"{exc} 请先在环境变量中设置 LIEXIAOXIA_TOKEN；"
                "如果还没有 token，请到 "
                "https://vacs.tongdao.cn/visa/persionaccesstoken/list 获取。"
            ),
            "request_payload": payload,
            "warnings": warnings,
        }
        print(json.dumps(output, ensure_ascii=False))
        return 5

    try:
        raw_text = post_json(url, payload=payload, token=token)
        parsed = json.loads(raw_text)
        if not isinstance(parsed, list):
            raise ValueError("搜索接口返回不是数组")
    except urllib.error.HTTPError as exc:
        output = {
            "success": False,
            "error": "http_error",
            "status_code": exc.code,
            "message": exc.read().decode("utf-8", errors="replace"),
            "request_payload": payload,
            "warnings": warnings,
        }
        print(json.dumps(output, ensure_ascii=False))
        return 2
    except (ValueError, json.JSONDecodeError) as exc:
        output = {
            "success": False,
            "error": "invalid_response",
            "message": str(exc),
            "raw_text": raw_text if "raw_text" in locals() else "",
            "request_payload": payload,
            "warnings": warnings,
        }
        print(json.dumps(output, ensure_ascii=False))
        return 4
    except Exception as exc:
        output = {
            "success": False,
            "error": "network_error",
            "message": str(exc),
            "request_payload": payload,
            "warnings": warnings,
        }
        print(json.dumps(output, ensure_ascii=False))
        return 3

    output = {
        "success": True,
        "action": "resume_search",
        "count": len(parsed),
        "request_payload": payload,
        "warnings": warnings,
        "results": parsed,
    }
    print(json.dumps(output, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
