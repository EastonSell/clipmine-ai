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
    storage_dir: Path = Field(default=Path("./storage"))
    model_cache_dir: Path = Field(default=Path("./storage/models"))
    whisper_model_size: str = "base"

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
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
