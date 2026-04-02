from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ClipMine AI API"
    environment: str = "development"
    port: int = 8000
    log_level: str = "DEBUG"
    backend_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    max_upload_mb: int = 1024
    storage_backend: str = "local"
    worker_concurrency: int = 1
    job_retention_hours: int = 168
    upload_part_size_mb: int = 16
    upload_session_ttl_minutes: int = 120
    storage_dir: Path = Field(default=Path("./storage"))
    model_cache_dir: Path = Field(default=Path("./storage/models"))
    whisper_model_size: str = "base"
    s3_bucket: str = ""
    s3_region: str = "us-east-1"
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_force_path_style: bool = False

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @property
    def jobs_dir(self) -> Path:
        return self.storage_dir / "jobs"

    @property
    def upload_sessions_dir(self) -> Path:
        return self.storage_dir / "upload-sessions"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def upload_part_size_bytes(self) -> int:
        return self.upload_part_size_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
