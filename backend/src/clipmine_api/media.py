from __future__ import annotations

import logging
import subprocess
import wave
from pathlib import Path

import av
import imageio_ffmpeg
import numpy as np

logger = logging.getLogger("uvicorn.error")

DECODE_FAILURE_MESSAGE = (
    "Source video could not be decoded. Try another MP4 or MOV file with a readable audio track."
)


class MediaProcessingError(RuntimeError):
    pass


def extract_audio(video_path: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-sample_fmt",
        "s16",
        str(output_path),
    ]
    logger.info("media.extract_audio start video_path=%s output_path=%s", video_path, output_path)
    logger.debug("media.extract_audio command=%s", " ".join(command))
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        logger.error("media.extract_audio failed video_path=%s stderr=%s", video_path, completed.stderr.strip())
        raise MediaProcessingError(DECODE_FAILURE_MESSAGE)
    logger.info("media.extract_audio complete output_path=%s", output_path)


def extract_audio_clip(video_path: Path, output_path: Path, *, start_time: float, end_time: float) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    duration = max(0.1, end_time - start_time)
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-y",
        "-i",
        str(video_path),
        "-ss",
        f"{max(0.0, start_time):.3f}",
        "-t",
        f"{duration:.3f}",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-sample_fmt",
        "s16",
        "-c:a",
        "pcm_s16le",
        str(output_path),
    ]
    logger.info(
        "media.extract_audio_clip start video_path=%s output_path=%s start=%.3f end=%.3f",
        video_path,
        output_path,
        start_time,
        end_time,
    )
    logger.debug("media.extract_audio_clip command=%s", " ".join(command))
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        logger.error(
            "media.extract_audio_clip failed video_path=%s output_path=%s stderr=%s",
            video_path,
            output_path,
            completed.stderr.strip(),
        )
        raise MediaProcessingError(DECODE_FAILURE_MESSAGE)
    logger.info("media.extract_audio_clip complete output_path=%s", output_path)


def extract_video_clip(video_path: Path, output_path: Path, *, start_time: float, end_time: float) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    duration = max(0.1, end_time - start_time)
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-y",
        "-i",
        str(video_path),
        "-ss",
        f"{max(0.0, start_time):.3f}",
        "-t",
        f"{duration:.3f}",
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    logger.info(
        "media.extract_video_clip start video_path=%s output_path=%s start=%.3f end=%.3f",
        video_path,
        output_path,
        start_time,
        end_time,
    )
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        logger.error(
            "media.extract_video_clip failed video_path=%s output_path=%s stderr=%s",
            video_path,
            output_path,
            completed.stderr.strip(),
        )
        raise RuntimeError(completed.stderr.strip() or "ffmpeg clip extraction failed")
    logger.info("media.extract_video_clip complete output_path=%s", output_path)


def extract_audio_spectrogram(video_path: Path, output_path: Path, *, start_time: float, end_time: float) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    duration = max(0.1, end_time - start_time)
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-y",
        "-ss",
        f"{max(0.0, start_time):.3f}",
        "-t",
        f"{duration:.3f}",
        "-i",
        str(video_path),
        "-lavfi",
        "showspectrumpic=s=1280x512:legend=disabled:scale=log:color=intensity",
        "-frames:v",
        "1",
        str(output_path),
    ]
    logger.info(
        "media.extract_audio_spectrogram start video_path=%s output_path=%s start=%.3f end=%.3f",
        video_path,
        output_path,
        start_time,
        end_time,
    )
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        logger.error(
            "media.extract_audio_spectrogram failed video_path=%s output_path=%s stderr=%s",
            video_path,
            output_path,
            completed.stderr.strip(),
        )
        raise MediaProcessingError(DECODE_FAILURE_MESSAGE)
    logger.info("media.extract_audio_spectrogram complete output_path=%s", output_path)


def probe_media_duration(media_path: Path) -> float | None:
    logger.debug("media.probe_duration path=%s", media_path)
    try:
        with av.open(str(media_path)) as container:
            if container.duration is None:
                return None
            return float(container.duration / av.time_base)
    except Exception as exc:
        logger.error("media.probe_duration failed path=%s error=%s", media_path, exc)
        raise MediaProcessingError(DECODE_FAILURE_MESSAGE) from exc


def load_mono_wave(audio_path: Path) -> tuple[np.ndarray, int]:
    logger.debug("media.load_wave path=%s", audio_path)
    with wave.open(str(audio_path), "rb") as wav_file:
        sample_rate = wav_file.getframerate()
        sample_width = wav_file.getsampwidth()
        frame_count = wav_file.getnframes()
        audio_bytes = wav_file.readframes(frame_count)

    if sample_width != 2:
        raise RuntimeError("Expected 16-bit PCM wav audio")

    audio = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    logger.debug("media.load_wave complete path=%s sample_rate=%s frame_count=%s", audio_path, sample_rate, frame_count)
    return audio, sample_rate
