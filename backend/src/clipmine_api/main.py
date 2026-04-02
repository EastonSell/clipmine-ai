from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router
from .config import get_settings
from .processor import JobProcessor
from .storage import JobStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    store = JobStore(settings)
    processor = JobProcessor(store)
    app.state.settings = settings
    app.state.job_store = store
    app.state.job_processor = processor
    await processor.start()
    yield
    await processor.stop()


app = FastAPI(title="ClipMine AI API", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
