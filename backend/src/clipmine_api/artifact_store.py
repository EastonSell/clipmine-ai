from __future__ import annotations

from abc import ABC, abstractmethod
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import boto3
from botocore.client import BaseClient
from botocore.config import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError
from fastapi.responses import FileResponse, StreamingResponse

from .config import Settings
from .schemas import SourceVideoRecord, UploadSessionRecord


@dataclass(slots=True)
class UploadPartDescriptor:
    part_number: int
    url: str


class ArtifactStore(ABC):
    backend_name = "local"
    supports_multipart_uploads = False

    @abstractmethod
    def is_reachable(self) -> bool:
        raise NotImplementedError

    def create_multipart_upload(self, source: SourceVideoRecord) -> str:
        raise RuntimeError("Multipart uploads are unavailable for the current storage backend.")

    def get_presigned_part_url(
        self,
        source: SourceVideoRecord,
        *,
        upload_id: str,
        part_number: int,
        expires_in_seconds: int,
    ) -> str:
        raise RuntimeError("Multipart uploads are unavailable for the current storage backend.")

    def complete_multipart_upload(
        self,
        source: SourceVideoRecord,
        *,
        upload_id: str,
        parts: list[dict[str, object]],
    ) -> None:
        raise RuntimeError("Multipart uploads are unavailable for the current storage backend.")

    def abort_multipart_upload(self, session: UploadSessionRecord) -> None:
        return None

    def download_source_video(self, source: SourceVideoRecord, destination: Path) -> None:
        raise RuntimeError("Remote source download is unavailable for the current storage backend.")

    def build_video_response(self, source: SourceVideoRecord, *, range_header: str | None):
        raise RuntimeError("Remote video streaming is unavailable for the current storage backend.")


class LocalArtifactStore(ArtifactStore):
    backend_name = "local"
    supports_multipart_uploads = False

    def __init__(self, settings: Settings):
        self.settings = settings

    def is_reachable(self) -> bool:
        return True

    def build_video_response(self, source: SourceVideoRecord, *, range_header: str | None):
        path = self.settings.storage_dir / source.relative_path
        return FileResponse(path, media_type=source.content_type, filename=source.file_name)


class S3ArtifactStore(ArtifactStore):
    backend_name = "s3"
    supports_multipart_uploads = True

    def __init__(self, settings: Settings):
        self.settings = settings
        self.bucket = settings.s3_bucket
        client_kwargs: dict[str, object] = {
            "service_name": "s3",
            "region_name": settings.s3_region,
        }
        if settings.s3_endpoint_url:
            client_kwargs["endpoint_url"] = settings.s3_endpoint_url
        if settings.s3_access_key_id:
            client_kwargs["aws_access_key_id"] = settings.s3_access_key_id
        if settings.s3_secret_access_key:
            client_kwargs["aws_secret_access_key"] = settings.s3_secret_access_key
        config_kwargs: dict[str, object] = {"signature_version": "s3v4"}
        if settings.s3_force_path_style:
            config_kwargs["s3"] = {"addressing_style": "path"}
        client_kwargs["config"] = BotoConfig(**config_kwargs)
        self.client: BaseClient = boto3.client(**client_kwargs)

    def is_reachable(self) -> bool:
        if not self.bucket:
            return False
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except (BotoCoreError, ClientError):
            return False
        return True

    def create_multipart_upload(self, source: SourceVideoRecord) -> str:
        response = self.client.create_multipart_upload(
            Bucket=self.bucket,
            Key=source.relative_path,
            ContentType=source.content_type,
        )
        return str(response["UploadId"])

    def get_presigned_part_url(
        self,
        source: SourceVideoRecord,
        *,
        upload_id: str,
        part_number: int,
        expires_in_seconds: int,
    ) -> str:
        return str(
            self.client.generate_presigned_url(
                ClientMethod="upload_part",
                Params={
                    "Bucket": self.bucket,
                    "Key": source.relative_path,
                    "UploadId": upload_id,
                    "PartNumber": part_number,
                },
                ExpiresIn=expires_in_seconds,
            )
        )

    def complete_multipart_upload(
        self,
        source: SourceVideoRecord,
        *,
        upload_id: str,
        parts: list[dict[str, object]],
    ) -> None:
        normalized_parts = [
            {
                "ETag": str(part["etag"]),
                "PartNumber": int(part["partNumber"]),
            }
            for part in parts
        ]
        self.client.complete_multipart_upload(
            Bucket=self.bucket,
            Key=source.relative_path,
            UploadId=upload_id,
            MultipartUpload={"Parts": normalized_parts},
        )

    def abort_multipart_upload(self, session: UploadSessionRecord) -> None:
        if not session.upload_id:
            return
        with suppress(BotoCoreError, ClientError):
            self.client.abort_multipart_upload(
                Bucket=self.bucket,
                Key=session.relative_path,
                UploadId=session.upload_id,
            )

    def download_source_video(self, source: SourceVideoRecord, destination: Path) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as handle:
            self.client.download_fileobj(self.bucket, source.relative_path, handle)

    def build_video_response(self, source: SourceVideoRecord, *, range_header: str | None):
        request_kwargs: dict[str, object] = {
            "Bucket": self.bucket,
            "Key": source.relative_path,
        }
        if range_header:
            request_kwargs["Range"] = range_header

        response = self.client.get_object(**request_kwargs)
        body = response["Body"]

        def iterator() -> Iterable[bytes]:
            try:
                for chunk in body.iter_chunks(chunk_size=1024 * 1024):
                    if chunk:
                        yield chunk
            finally:
                with suppress(Exception):
                    body.close()

        headers: dict[str, str] = {
            "Accept-Ranges": "bytes",
        }
        if response.get("ContentLength") is not None:
            headers["Content-Length"] = str(response["ContentLength"])
        if response.get("ContentRange"):
            headers["Content-Range"] = str(response["ContentRange"])
        if response.get("ETag"):
            headers["ETag"] = str(response["ETag"])

        status_code = 206 if "Content-Range" in headers else 200
        return StreamingResponse(iterator(), media_type=source.content_type, status_code=status_code, headers=headers)


def create_artifact_store(settings: Settings) -> ArtifactStore:
    if settings.storage_backend == "s3":
        return S3ArtifactStore(settings)
    return LocalArtifactStore(settings)
