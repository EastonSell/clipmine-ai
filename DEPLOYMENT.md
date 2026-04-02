# Deployment

## Frontend on Vercel

1. Import the GitHub repository into Vercel.
2. Set the root directory to `apps/web`.
3. Add `NEXT_PUBLIC_API_BASE_URL` pointing at the backend URL.
4. Deploy with the default Next.js preset.

## Backend on Render

1. Create a new Web Service from the GitHub repository.
2. Use the Docker runtime and set the Dockerfile path to `backend/Dockerfile`.
3. Attach a persistent disk and mount it at `/var/data/clipmine`.
4. Set:
   - `PORT=8000`
   - `STORAGE_DIR=/var/data/clipmine/storage`
   - `MODEL_CACHE_DIR=/var/data/clipmine/models`
   - `WHISPER_MODEL_SIZE=base`
   - `BACKEND_CORS_ORIGINS=https://your-frontend-domain.vercel.app`
   - `MAX_UPLOAD_MB=250`
5. Deploy and verify `GET /api/health`.

## Required Environment Variables

- `NEXT_PUBLIC_API_BASE_URL`
- `BACKEND_CORS_ORIGINS`
- `MAX_UPLOAD_MB`
- `STORAGE_DIR`
- `MODEL_CACHE_DIR`
- `WHISPER_MODEL_SIZE`
- `PORT`

## Known Limitations

- First-run transcription is slower because the Whisper model downloads on demand.
- CPU transcription is reliable but not optimized for large-batch processing.
- Local file storage is single-instance by design.

## Troubleshooting

- If uploads fail, confirm the backend CORS origin includes the frontend URL.
- If transcription fails on first run, confirm the service can write to `MODEL_CACHE_DIR`.
- If video processing fails in production, confirm persistent disk permissions and available storage.

