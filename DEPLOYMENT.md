# Deployment Guide

## Overview

- Frontend deploy target: Vercel
- Backend deploy target: Render Web Service
- Production upload target: S3-compatible object storage
- Persistence requirement: Render persistent disk for manifests, temporary processing artifacts, and Whisper model cache

The deployment split avoids serverless timeouts and keeps video processing off the frontend platform.

## Frontend Deployment On Vercel

1. Push the repository to GitHub.
2. Create a new Vercel project from the repo.
3. Set the project root directory to `apps/web`.
4. Keep the framework preset as `Next.js`.
5. Add this environment variable:

```text
NEXT_PUBLIC_API_BASE_URL=https://your-backend.onrender.com
NEXT_PUBLIC_MAX_UPLOAD_MB=1024
NEXT_PUBLIC_UPLOAD_MODE=multipart
```

6. Deploy.
7. After the first deploy, verify the landing page loads and the upload form points at the backend URL.
8. Confirm the built frontend is using multipart upload mode instead of direct backend uploads.

## Backend Deployment On Render

1. Create a new Web Service from the GitHub repository.
2. Choose the Docker runtime.
3. Set the Dockerfile path to `backend/Dockerfile`.
4. Attach a persistent disk.
5. Mount that disk at `/var/data/clipmine`.
6. Add these environment variables:

```text
PORT=8000
STORAGE_DIR=/var/data/clipmine/storage
STORAGE_BACKEND=s3
MODEL_CACHE_DIR=/var/data/clipmine/models
WHISPER_MODEL_SIZE=base
LOG_LEVEL=DEBUG
MAX_UPLOAD_MB=1024
UPLOAD_PART_SIZE_MB=16
UPLOAD_SESSION_TTL_MINUTES=120
BACKEND_CORS_ORIGINS=https://your-frontend.vercel.app
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ENDPOINT_URL=
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_FORCE_PATH_STYLE=false
```

7. Deploy and verify `GET /api/health`.
8. Confirm `/api/health` shows `checks.objectStoreReachable=true`.
9. Upload a short test video through the frontend to confirm:
   - `/api/uploads/init` succeeds
   - the browser uploads parts directly to object storage
   - `/api/uploads/{uploadSessionId}/complete` returns a queued job
   - `/api/jobs/{jobId}/video` streams playback through the backend proxy

## Required Environment Variables

| Variable | Used By | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | Public backend base URL |
| `NEXT_PUBLIC_UPLOAD_MODE` | frontend | `direct` for local development, `multipart` for production object storage uploads |
| `BACKEND_CORS_ORIGINS` | backend | Allowed browser origins |
| `LOG_LEVEL` | backend | Backend runtime logging verbosity |
| `MAX_UPLOAD_MB` | backend | Upload size limit |
| `STORAGE_DIR` | backend | Job artifacts and manifests |
| `STORAGE_BACKEND` | backend | `local` or `s3` source-video storage |
| `MODEL_CACHE_DIR` | backend | Whisper model cache |
| `WHISPER_MODEL_SIZE` | backend | Whisper model selection |
| `UPLOAD_PART_SIZE_MB` | backend | Multipart upload part size in megabytes |
| `UPLOAD_SESSION_TTL_MINUTES` | backend | Upload-session expiration window |
| `S3_BUCKET` | backend | S3-compatible bucket or container name |
| `S3_REGION` | backend | S3-compatible region |
| `S3_ENDPOINT_URL` | backend | Optional custom endpoint for R2, B2, MinIO, etc. |
| `S3_ACCESS_KEY_ID` | backend | Object storage access key |
| `S3_SECRET_ACCESS_KEY` | backend | Object storage secret key |
| `S3_FORCE_PATH_STYLE` | backend | Enable path-style S3 URLs when required |
| `PORT` | backend | HTTP port |

## Known Limitations

- First-run transcription is slower because the model downloads on first use.
- CPU transcription is optimized for reliability, not batch throughput.
- Multipart upload retries only cover the current browser session. Uploads do not yet resume after a full tab or browser restart.
- Temporary audio and remote-source cache files still use the Render disk during processing.
- The app uses source-video seeking for playback instead of pre-rendered clip assets.

## Troubleshooting

### Upload fails from the browser

- Confirm `NEXT_PUBLIC_API_BASE_URL` points to the live backend.
- Confirm `NEXT_PUBLIC_UPLOAD_MODE=multipart` for production deployments using object storage.
- Confirm `BACKEND_CORS_ORIGINS` includes the exact frontend origin.
- For local development, include both `http://localhost:3000` and `http://127.0.0.1:3000` if you use both.
- Confirm the upload is `.mp4` or `.mov`.
- Check `/api/health` and verify `checks.objectStoreReachable=true` before testing multipart uploads.

### Multipart upload stalls or fails to finalize

- Confirm `S3_BUCKET`, credentials, and endpoint settings are correct.
- Confirm the bucket allows multipart uploads and returns `ETag` headers for uploaded parts.
- Check backend logs for `upload.init_failed` or `upload.complete_failed`.
- If your provider requires path-style URLs, set `S3_FORCE_PATH_STYLE=true`.

### Backend job never reaches `ready`

- Check Render logs for ffmpeg extraction or Whisper download errors.
- Confirm the persistent disk is mounted and writable.
- Confirm the backend can download the source object from storage into the temporary processing cache.
- Confirm enough disk space remains for uploads and model files.

### Export button is disabled

- The job is still `queued` or `processing`.
- Refresh the workspace or wait for the polling cycle to complete.
