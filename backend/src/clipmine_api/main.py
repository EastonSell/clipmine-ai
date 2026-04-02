from __future__ import annotations

import logging
from time import perf_counter
from uuid import uuid4
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router
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
    processor = JobProcessor(store)
    app.state.settings = settings
    app.state.job_store = store
    app.state.job_processor = processor
    logger.info(
        "app.startup environment=%s port=%s log_level=%s storage_dir=%s model_cache_dir=%s max_upload_mb=%s",
        settings.environment,
        settings.port,
        settings.log_level.upper(),
        settings.storage_dir,
        settings.model_cache_dir,
        settings.max_upload_mb,
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
