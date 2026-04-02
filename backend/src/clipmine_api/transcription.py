from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path

from faster_whisper import WhisperModel

from .config import get_settings
from .pipeline_types import TranscriptionResult, WordToken

logger = logging.getLogger("uvicorn.error")


@lru_cache(maxsize=1)
def get_model() -> WhisperModel:
    settings = get_settings()
    os.environ.setdefault("HF_HOME", str(settings.model_cache_dir))
    settings.model_cache_dir.mkdir(parents=True, exist_ok=True)
    logger.info(
        "transcription.model_load size=%s cache_dir=%s device=cpu compute_type=int8",
        settings.whisper_model_size,
        settings.model_cache_dir,
    )
    return WhisperModel(
        settings.whisper_model_size,
        device="cpu",
        compute_type="int8",
        download_root=str(settings.model_cache_dir),
    )


def transcribe_audio(audio_path: Path) -> TranscriptionResult:
    model = get_model()
    logger.info("transcription.start audio_path=%s", audio_path)
    segments, info = model.transcribe(
        str(audio_path),
        beam_size=1,
        word_timestamps=True,
        vad_filter=True,
        condition_on_previous_text=False,
    )

    words: list[WordToken] = []
    transcript_parts: list[str] = []
    for segment in segments:
        cleaned_text = segment.text.strip()
        if cleaned_text:
            transcript_parts.append(cleaned_text)
        for word in segment.words or []:
            raw_text = word.word or ""
            text = raw_text.strip()
            if not text:
                continue
            start = float(word.start or segment.start or 0.0)
            end = float(word.end or segment.end or start)
            probability = float(getattr(word, "probability", 0.0) or 0.0)
            words.append(
                WordToken(
                    text=text,
                    raw_text=raw_text,
                    start=max(0.0, start),
                    end=max(start, end),
                    probability=max(0.0, min(probability, 1.0)),
                )
            )

    duration = float(getattr(info, "duration", 0.0) or 0.0) if info is not None else None
    language = getattr(info, "language", None) if info is not None else None
    logger.info(
        "transcription.complete audio_path=%s words=%s transcript_chars=%s language=%s duration_seconds=%s",
        audio_path,
        len(words),
        len(" ".join(transcript_parts).strip()),
        language,
        duration,
    )
    return TranscriptionResult(
        words=words,
        transcript_text=" ".join(transcript_parts).strip(),
        language=language,
        duration_seconds=duration,
    )
