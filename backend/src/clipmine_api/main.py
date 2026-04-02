from __future__ import annotations

import logging
from time import perf_counter
from uuid import uuid4
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .artifact_store import create_artifact_store
from .api import router
from .errors import build_error_detail, normalize_error_detail
from .config import get_settings
from .processor import JobProcessor
from .storage import JobStore

logger = logging.getLogger("uvicorn.error")


def configure_logging(log_level: str) -> None:
    resolved_level = getattr(logging, log_level.upper(), logging.INFO)
    root_level = logging.INFO if resolved_level < logging.INFO else resolved_level
    logging.basicConfig(
        level=root_level,
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        force=True,
    )
    logging.getLogger("uvicorn.error").setLevel(resolved_level)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("python_multipart").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.INFO)
    logging.getLogger("faster_whisper").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    store = JobStore(settings)
    artifact_store = create_artifact_store(settings)
    processor = JobProcessor(
        store,
        artifact_store,
        worker_concurrency=settings.worker_concurrency,
        retention_hours=settings.job_retention_hours,
    )
    app.state.settings = settings
    app.state.job_store = store
    app.state.artifact_store = artifact_store
    app.state.job_processor = processor
    logger.info(
        "app.startup environment=%s port=%s log_level=%s storage_dir=%s model_cache_dir=%s max_upload_mb=%s worker_concurrency=%s retention_hours=%s storage_backend=%s",
        settings.environment,
        settings.port,
        settings.log_level.upper(),
        settings.storage_dir,
        settings.model_cache_dir,
        settings.max_upload_mb,
        settings.worker_concurrency,
        settings.job_retention_hours,
        settings.storage_backend,
    )
    await processor.start()
    yield
    await processor.stop()
    logger.info("app.shutdown complete")


app = FastAPI(title="ClipMine AI API", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request, exc: RequestValidationError):
    logger.warning("request.validation_error path=%s errors=%s", request.url.path, exc.errors())
    return JSONResponse(
        status_code=422,
        content={
            "detail": build_error_detail(
                "invalid_request",
                "The request payload was invalid.",
                retryable=False,
            )
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    normalized = normalize_error_detail(exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"detail": normalized})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    logger.exception("request.unhandled_error path=%s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": build_error_detail(
                "internal_server_error",
                "Unexpected server error.",
                retryable=False,
            )
        },
    )


@app.middleware("http")
async def log_http_requests(request, call_next):
    request_id = uuid4().hex[:8]
    started_at = perf_counter()
    logger.info(
        "request.start id=%s method=%s path=%s client=%s content_length=%s content_type=%s",
        request_id,
        request.method,
        request.url.path,
        request.client.host if request.client else "unknown",
        request.headers.get("content-length", "unknown"),
        request.headers.get("content-type", "unknown"),
    )

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (perf_counter() - started_at) * 1000
        logger.exception("request.error id=%s path=%s duration_ms=%.1f", request_id, request.url.path, duration_ms)
        raise

    duration_ms = (perf_counter() - started_at) * 1000
    logger.info(
        "request.end id=%s method=%s path=%s status=%s duration_ms=%.1f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    response.headers["X-Request-ID"] = request_id
    return response

app.include_router(router)
