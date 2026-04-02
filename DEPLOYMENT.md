# Deployment Guide

## Overview

- Frontend deploy target: Vercel
- Backend deploy target: Render Web Service
- Persistence requirement: Render persistent disk for uploads, manifests, and Whisper model cache

The deployment split avoids serverless timeouts and keeps video processing off the frontend platform.

## Frontend Deployment On Vercel

1. Push the repository to GitHub.
2. Create a new Vercel project from the repo.
3. Set the project root directory to `apps/web`.
4. Keep the framework preset as `Next.js`.
5. Add this environment variable:

```text
NEXT_PUBLIC_API_BASE_URL=https://your-backend.onrender.com
```

6. Deploy.
7. After the first deploy, verify the landing page loads and the upload form points at the backend URL.

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
MODEL_CACHE_DIR=/var/data/clipmine/models
WHISPER_MODEL_SIZE=base
MAX_UPLOAD_MB=250
BACKEND_CORS_ORIGINS=https://your-frontend.vercel.app
```

7. Deploy and verify `GET /api/health`.
8. Upload a short test video through the frontend to confirm the full path.

## Required Environment Variables

| Variable | Used By | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | Public backend base URL |
| `BACKEND_CORS_ORIGINS` | backend | Allowed browser origins |
| `MAX_UPLOAD_MB` | backend | Upload size limit |
| `STORAGE_DIR` | backend | Job artifacts and manifests |
| `MODEL_CACHE_DIR` | backend | Whisper model cache |
| `WHISPER_MODEL_SIZE` | backend | Whisper model selection |
| `PORT` | backend | HTTP port |

## Known Limitations

- First-run transcription is slower because the model downloads on first use.
- CPU transcription is optimized for reliability, not batch throughput.
- Storage is local to a single backend instance in v1.
- The app uses source-video seeking for playback instead of pre-rendered clip assets.

## Troubleshooting

### Upload fails from the browser

- Confirm `NEXT_PUBLIC_API_BASE_URL` points to the live backend.
- Confirm `BACKEND_CORS_ORIGINS` includes the exact frontend origin.
- Confirm the upload is `.mp4` or `.mov`.

### Backend job never reaches `ready`

- Check Render logs for ffmpeg extraction or Whisper download errors.
- Confirm the persistent disk is mounted and writable.
- Confirm enough disk space remains for uploads and model files.

### Export button is disabled

- The job is still `queued` or `processing`.
- Refresh the workspace or wait for the polling cycle to complete.

