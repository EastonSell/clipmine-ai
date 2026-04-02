from __future__ import annotations

from typing import Any

from fastapi import HTTPException


def build_error_detail(code: str, message: str, *, retryable: bool = False) -> dict[str, object]:
    return {
        "code": code,
        "message": message,
        "retryable": retryable,
    }


def build_http_error(
    status_code: int,
    code: str,
    message: str,
    *,
    retryable: bool = False,
) -> HTTPException:
    return HTTPException(status_code=status_code, detail=build_error_detail(code, message, retryable=retryable))


def normalize_error_detail(detail: Any, default_code: str = "http_error") -> dict[str, object]:
    if isinstance(detail, dict):
        return {
            "code": str(detail.get("code") or default_code),
            "message": str(detail.get("message") or "Something went wrong."),
            "retryable": bool(detail.get("retryable", False)),
        }

    if isinstance(detail, str):
        return build_error_detail(default_code, detail, retryable=False)

    return build_error_detail(default_code, "Something went wrong.", retryable=False)
