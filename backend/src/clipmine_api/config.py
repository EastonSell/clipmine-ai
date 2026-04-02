from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ClipMine AI API"
    environment: str = "development"
    port: int = 8000
    backend_cors_origins: str = "http://localhost:3000"
    max_upload_mb: int = 250
    storage_dir: Path = Field(default=Path("./storage"))
    model_cache_dir: Path = Field(default=Path("./storage/models"))
    whisper_model_size: str = "base"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

