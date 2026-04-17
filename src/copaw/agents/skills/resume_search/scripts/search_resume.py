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

DEFAULT_LIEXIAOXIA_BASE_URL = (
    "http://open-agent-sandbox20711.sandbox.tongdao.cn"
)
SEARCH_PATH = "/liexiaoxia/resume/search_resume"
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


INT_FIELDS = {
    "ageLow",
    "ageHigh",
    "workYearLow",
    "workYearHigh",
    "yearSalLow",
    "yearSalHigh",
    "wantYearSalLow",
    "wantYearSalHigh",
    "curPage",
    "pageSize",
    "filterChat",
    "filterDownload",
    "filterRead",
}

COMMA_JOIN_FIELDS = {
    "dqs",
    "wantDqs",
    "houseHolds",
    "schoolDqs",
}

SPACE_JOIN_FIELDS = {
    "graduationYear",
    "languageContents",
    "schools",
    "specials",
    "eduLevel",
    "eduLevelTzs",
    "company",
    "jobTitle",
    "resTagList",
}

STRING_FIELDS = {
    "sex",
    "resLanguage",
    "marriage",
    "abroadExp",
    "abroadEdu",
    "manageExp",
    "keyword",
}

SUPPORTED_PROPERTIES = (
    INT_FIELDS | COMMA_JOIN_FIELDS | SPACE_JOIN_FIELDS | STRING_FIELDS
)

PROPERTY_ALIASES = {
    "compsNormalized": "company",
    "titlesWithPayload": "jobTitle",
    "contextBm25": "keyword",
    "yearSalary": "yearSalLow",
    "abroad": "abroadExp",
}

NON_SEARCH_CONTROL_FIELDS = {
    "curPage",
    "pageSize",
    "filterChat",
    "filterDownload",
    "filterRead",
}

FILTER_FIELD_BOUNDS = {
    "filterChat": {0, 1, 2},
    "filterDownload": {0, 1, 2},
    "filterRead": {0, 1},
}


def parse_list_argument(raw: str) -> list[str]:
    text = raw.strip()
    if not text:
        return []
    if text.startswith("["):
        parsed = json.loads(text)
        if not isinstance(parsed, list):
            raise ValueError("列表参数必须是 JSON 数组")
        return _normalize_string_list(parsed)
    return _normalize_string_list(text.replace(",", " ").split())


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


def _looks_like_keyword_expression(text: str) -> bool:
    normalized = text.lower()
    return "(" in text or ")" in text or " and " in normalized or " or " in normalized


def _canonical_property_name(property_name: str) -> str:
    normalized = _normalize_scalar(property_name)
    return PROPERTY_ALIASES.get(normalized, normalized)


def _normalize_int(value: Any, *, field_name: str) -> int:
    if isinstance(value, bool):
        raise ValueError(f"{field_name} 必须是整数。")
    if isinstance(value, int):
        return value
    text = _normalize_scalar(value)
    if not text:
        raise ValueError(f"{field_name} 的 value 不能为空。")
    try:
        return int(text)
    except ValueError as exc:
        raise ValueError(f"{field_name} 必须是整数。") from exc


def _normalize_list_string(field_name: str, value: Any) -> str:
    if isinstance(value, list):
        values = _normalize_string_list(value)
    else:
        text = _normalize_scalar(value)
        if not text:
            raise ValueError(f"{field_name} 的 value 不能为空。")
        if text.startswith("["):
            values = parse_list_argument(text)
        elif field_name in COMMA_JOIN_FIELDS:
            values = _normalize_string_list(text.split(","))
        else:
            values = _normalize_string_list(text.replace(",", " ").split())

    if not values:
        raise ValueError(f"{field_name} 的 value 不能为空。")

    separator = "," if field_name in COMMA_JOIN_FIELDS else " "
    return separator.join(values)


def _format_keyword_values(values: list[str]) -> str:
    normalized = _normalize_string_list(values)
    if not normalized:
        raise ValueError("keyword 的 value 不能为空。")

    expression_groups: list[str] = []
    plain_terms: list[str] = []
    for value in normalized:
        if _looks_like_keyword_expression(value):
            expression_groups.append(value)
        else:
            plain_terms.append(value)

    parts: list[str] = []
    if plain_terms:
        parts.append(f"({' or '.join(plain_terms)})")
    parts.extend(expression_groups)

    return " and ".join(parts) if len(parts) > 1 else parts[0]


def _normalize_keyword(value: Any) -> str:
    if isinstance(value, list):
        return _format_keyword_values(value)

    text = _normalize_scalar(value)
    if not text:
        raise ValueError("keyword 的 value 不能为空。")
    if text.startswith("["):
        return _format_keyword_values(parse_list_argument(text))
    if "," in text and not _looks_like_keyword_expression(text):
        return _format_keyword_values([part for part in text.split(",")])
    return text


def _normalize_field_value(field_name: str, value: Any) -> Any:
    normalized_field = _canonical_property_name(field_name)
    if normalized_field not in SUPPORTED_PROPERTIES:
        raise ValueError(f"不支持的 propertyName: {field_name}")

    if normalized_field in INT_FIELDS:
        return _normalize_int(value, field_name=normalized_field)
    if normalized_field in COMMA_JOIN_FIELDS | SPACE_JOIN_FIELDS:
        return _normalize_list_string(normalized_field, value)
    if normalized_field == "keyword":
        return _normalize_keyword(value)

    normalized_value = _normalize_scalar(value)
    if not normalized_value:
        raise ValueError(f"{normalized_field} 的 value 不能为空。")
    return normalized_value


def _split_existing_values(field_name: str, value: Any) -> list[str]:
    text = _normalize_scalar(value)
    if not text:
        return []
    if field_name in COMMA_JOIN_FIELDS:
        return _normalize_string_list(text.split(","))
    if field_name in SPACE_JOIN_FIELDS:
        return _normalize_string_list(text.replace(",", " ").split())
    return [text]


def _merge_field(criteria: dict[str, Any], field_name: str, value: Any) -> None:
    if field_name not in criteria:
        criteria[field_name] = value
        return

    if field_name in COMMA_JOIN_FIELDS | SPACE_JOIN_FIELDS:
        merged = _split_existing_values(field_name, criteria[field_name]) + _split_existing_values(field_name, value)
        separator = "," if field_name in COMMA_JOIN_FIELDS else " "
        criteria[field_name] = separator.join(_normalize_string_list(merged))
        return

    if field_name == "keyword":
        existing = _normalize_scalar(criteria[field_name])
        incoming = _normalize_scalar(value)
        if existing and incoming and existing != incoming:
            criteria[field_name] = f"{existing} and {incoming}"
        elif incoming:
            criteria[field_name] = incoming
        return

    criteria[field_name] = value


def _ensure_searchable_criteria(criteria: dict[str, Any]) -> None:
    searchable = [
        key for key in criteria if key not in NON_SEARCH_CONTROL_FIELDS
    ]
    if not searchable:
        raise ValueError("搜索请求至少要包含一个招聘条件，不能只传分页或过滤参数。")


def _criteria_payload(criteria: dict[str, Any]) -> dict[str, str]:
    _ensure_searchable_criteria(criteria)
    return {
        "boolSearchJsonStr": json.dumps(
            criteria,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    }


def _parse_criteria_json(raw: str) -> tuple[dict[str, Any], list[str]]:
    text = raw.strip()
    if not text:
        return {}, []

    parsed = json.loads(text)
    warnings: list[str] = []

    if isinstance(parsed, dict):
        criteria: dict[str, Any] = {}
        for key, value in parsed.items():
            normalized_key = _canonical_property_name(key)
            if normalized_key != key:
                warnings.append(
                    f"criteria-json 中的 `{key}` 已自动映射为 `{normalized_key}`。"
                )
            _merge_field(
                criteria,
                normalized_key,
                _normalize_field_value(normalized_key, value),
            )
        return criteria, warnings

    if not isinstance(parsed, list):
        raise ValueError("criteria-json 必须是 JSON 对象或兼容的属性数组。")

    criteria = {}
    for item in parsed:
        if not isinstance(item, dict):
            raise ValueError("criteria-json 的每一项都必须是对象。")

        property_name = _normalize_scalar(item.get("propertyName"))
        if not property_name:
            raise ValueError("criteria-json 中缺少 propertyName。")

        normalized_key = _canonical_property_name(property_name)
        if normalized_key != property_name:
            warnings.append(
                f"criteria-json 中的 `{property_name}` 已自动映射为 `{normalized_key}`。"
            )

        value = item.get("value")
        _merge_field(
            criteria,
            normalized_key,
            _normalize_field_value(normalized_key, value),
        )

    return criteria, warnings


def _normalize_explicit_bool_search_json_str(raw: str) -> str:
    text = raw.strip()
    if not text:
        raise ValueError("bool-search-json-str 不能为空。")

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return text

    if (
        isinstance(parsed, dict)
        and "boolSearchJsonStr" in parsed
        and len(parsed) == 1
    ):
        inner = parsed["boolSearchJsonStr"]
        if isinstance(inner, str):
            return inner
        return json.dumps(inner, ensure_ascii=False, separators=(",", ":"))

    if isinstance(parsed, dict | list):
        return json.dumps(parsed, ensure_ascii=False, separators=(",", ":"))

    return text


def build_resume_search_payload(
    criteria: dict[str, Any],
    *,
    page: int = 1,
    page_size: int = 20,
    filter_chat: int | None = None,
    filter_download: int | None = None,
    filter_read: int | None = None,
) -> tuple[dict[str, str], list[str]]:
    normalized = dict(criteria)
    warnings: list[str] = []

    normalized.setdefault("curPage", page)
    normalized.setdefault("pageSize", page_size)

    for field_name, value in (
        ("filterChat", filter_chat),
        ("filterDownload", filter_download),
        ("filterRead", filter_read),
    ):
        if value is None or field_name in normalized:
            continue
        normalized[field_name] = _normalize_field_value(field_name, value)

    return _criteria_payload(normalized), warnings


def _append_if_present(
    criteria: dict[str, Any],
    *,
    field_name: str,
    value: Any,
) -> None:
    if value is None:
        return
    if isinstance(value, str) and not value.strip():
        return
    _merge_field(
        criteria,
        field_name,
        _normalize_field_value(field_name, value),
    )


def build_legacy_resume_search_payload(
    args: argparse.Namespace,
) -> tuple[dict[str, str], list[str]]:
    criteria: dict[str, Any] = {}
    warnings: list[str] = []

    list_argument_mapping = (
        ("jobTitle", parse_list_argument(args.job_titles)),
        ("company", parse_list_argument(args.companies)),
        ("dqs", parse_list_argument(args.current_city)),
        ("wantDqs", parse_list_argument(args.expected_city)),
        ("eduLevel", parse_list_argument(args.education)),
        ("languageContents", parse_list_argument(args.languages)),
        ("houseHolds", parse_list_argument(args.house_holds)),
        ("graduationYear", parse_list_argument(args.graduation_year)),
        ("schools", parse_list_argument(args.schools)),
        ("specials", parse_list_argument(args.specials)),
        ("schoolDqs", parse_list_argument(args.school_dqs)),
        ("resTagList", parse_list_argument(args.res_tags)),
    )

    for field_name, values in list_argument_mapping:
        if values:
            _append_if_present(criteria, field_name=field_name, value=values)

    resume_keywords = parse_list_argument(args.resume_keywords)
    if resume_keywords:
        _append_if_present(criteria, field_name="keyword", value=resume_keywords)

    scalar_argument_mapping = (
        ("sex", args.gender if _normalize_scalar(args.gender) != "不限" else ""),
        ("resLanguage", args.resume_language),
        ("marriage", args.marriage),
        ("ageLow", args.age_low),
        ("ageHigh", args.age_high),
        ("workYearLow", args.work_year_low),
        ("workYearHigh", args.work_year_high),
        ("yearSalLow", args.current_salary_low),
        ("yearSalHigh", args.current_salary_high),
        ("wantYearSalLow", args.want_salary_low),
        ("wantYearSalHigh", args.want_salary_high),
        ("abroadExp", args.abroad_exp),
        ("abroadEdu", args.abroad_edu),
        ("manageExp", args.manage_exp),
        ("filterChat", args.filter_chat),
        ("filterDownload", args.filter_download),
        ("filterRead", args.filter_read),
    )

    for field_name, value in scalar_argument_mapping:
        _append_if_present(criteria, field_name=field_name, value=value)

    full_time_enroll = _normalize_scalar(args.full_time_enroll).lower()
    if full_time_enroll in {"true", "1", "yes", "y", "统招"}:
        education_values = parse_list_argument(args.education)
        if education_values:
            _append_if_present(
                criteria,
                field_name="eduLevelTzs",
                value=education_values,
            )
        else:
            warnings.append(
                "full-time-enroll 已开启，但未提供 education，无法自动推导 eduLevelTzs。"
            )
    elif full_time_enroll not in {"", "false", "0", "no", "n", "不限"}:
        warnings.append(
            "full-time-enroll 只支持 true / false；更复杂的统招条件请改用 --criteria-json。"
        )

    must_groups = _parse_legacy_must_groups(args.must_groups)
    if must_groups:
        field_map = {
            "jobTitles": "jobTitle",
            "companies": "company",
            "resumeKeywords": "keyword",
        }
        for group in must_groups:
            field_name = field_map.get(group["field"])
            if not field_name:
                raise ValueError(f"must-groups 暂不支持字段: {group['field']}")
            _append_if_present(
                criteria,
                field_name=field_name,
                value=group["values"],
            )
        warnings.append(
            "must-groups 仅做兼容映射；复杂关键词组合请优先使用 --criteria-json。"
        )

    return build_resume_search_payload(
        criteria,
        page=args.page,
        page_size=args.page_size,
    )[0], warnings


def _parse_legacy_must_groups(raw: str) -> list[dict[str, Any]]:
    text = raw.strip()
    if not text:
        return []
    parsed = json.loads(text)
    if not isinstance(parsed, list):
        raise ValueError("must-groups 必须是 JSON 数组。")

    groups: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            raise ValueError("must-groups 的每一项都必须是对象。")
        field_name = _normalize_scalar(item.get("field"))
        values = item.get("values")
        if not field_name:
            raise ValueError("must-groups 中缺少 field。")
        if not isinstance(values, list):
            raise ValueError("must-groups.values 必须是数组。")
        groups.append(
            {"field": field_name, "values": _normalize_string_list(values)}
        )
    return groups


def _validate_args(args: argparse.Namespace) -> None:
    if args.page < 1 or args.page_size < 1:
        raise ValueError("page 和 page-size 都必须是正整数。")

    for field_name in ("filter_chat", "filter_download", "filter_read"):
        value = getattr(args, field_name)
        if value is None:
            continue
        normalized_key = "".join(
            part.capitalize() if index else part
            for index, part in enumerate(field_name.split("_"))
        )
        valid_values = FILTER_FIELD_BOUNDS[normalized_key]
        if value not in valid_values:
            choices = ",".join(str(item) for item in sorted(valid_values))
            raise ValueError(f"{normalized_key} 只能是 {choices}。")


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

    parser.add_argument(
        "--criteria-json",
        default="",
        help="Preferred JSON object of search fields, or a legacy property array.",
    )
    parser.add_argument(
        "--bool-search-json-str",
        default="",
        help="Use an explicit boolSearchJsonStr string or a raw JSON object.",
    )
    parser.add_argument(
        "--print-payload-only",
        action="store_true",
        help="Print the assembled request payload and exit without calling the API.",
    )

    parser.add_argument("--job-titles", default="[]")
    parser.add_argument("--companies", default="[]")
    parser.add_argument("--resume-keywords", default="[]")
    parser.add_argument("--current-city", default="[]")
    parser.add_argument("--expected-city", default="[]")
    parser.add_argument("--education", default="[]")
    parser.add_argument("--languages", default="[]")
    parser.add_argument("--house-holds", default="[]")
    parser.add_argument("--graduation-year", default="[]")
    parser.add_argument("--schools", default="[]")
    parser.add_argument("--specials", default="[]")
    parser.add_argument("--school-dqs", default="[]")
    parser.add_argument("--res-tags", default="[]")
    parser.add_argument("--gender", default="不限")
    parser.add_argument("--resume-language", default="")
    parser.add_argument("--marriage", default="")
    parser.add_argument("--full-time-enroll", default="")
    parser.add_argument("--abroad-exp", default="")
    parser.add_argument("--abroad-edu", default="")
    parser.add_argument("--manage-exp", default="")
    parser.add_argument("--age-low", type=int, default=None)
    parser.add_argument("--age-high", type=int, default=None)
    parser.add_argument("--work-year-low", type=int, default=None)
    parser.add_argument("--work-year-high", type=int, default=None)
    parser.add_argument("--current-salary-low", type=int, default=None)
    parser.add_argument("--current-salary-high", type=int, default=None)
    parser.add_argument("--want-salary-low", type=int, default=None)
    parser.add_argument("--want-salary-high", type=int, default=None)
    parser.add_argument("--filter-chat", type=int, default=None)
    parser.add_argument("--filter-download", type=int, default=None)
    parser.add_argument("--filter-read", type=int, default=None)
    parser.add_argument("--must-groups", default="[]")
    args = parser.parse_args()

    try:
        _validate_args(args)
        warnings: list[str] = []
        if args.bool_search_json_str.strip():
            payload = {
                "boolSearchJsonStr": _normalize_explicit_bool_search_json_str(
                    args.bool_search_json_str
                )
            }
        elif args.criteria_json.strip():
            criteria, warnings = _parse_criteria_json(args.criteria_json)
            payload, build_warnings = build_resume_search_payload(
                criteria,
                page=args.page,
                page_size=args.page_size,
                filter_chat=args.filter_chat,
                filter_download=args.filter_download,
                filter_read=args.filter_read,
            )
            warnings.extend(build_warnings)
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

    url = args.base_url.rstrip("/") + SEARCH_PATH
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
            raise ValueError("搜索接口返回不是数组。")
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
