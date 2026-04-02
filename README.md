# ClipMine AI

ClipMine AI turns long-form talking-head video into ranked, training-ready speech clips. Upload a `.mp4` or `.mov`, inspect the strongest moments on a timeline, and export structured clip metadata for downstream multimodal workflows.

## Architecture

- `apps/web`: Next.js 16 App Router frontend
- `backend`: FastAPI processing API with disk-backed jobs
- `storage`: local job artifacts in development

## Local Setup

### Frontend

```bash
npm_config_cache=/tmp/clipmine-npm-cache npm install
npm run dev:web
```

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn clipmine_api.main:app --reload --port 8000
```

## Usage

1. Start the backend on port `8000`.
2. Start the web app on port `3000`.
3. Upload a video from the landing page.
4. Review ranked clips, timeline signal, and JSON export from the job workspace.

## Deployment

Frontend is designed for Vercel. Backend is designed for Render using the included Dockerfile and `render.yaml`.

See [DEPLOYMENT.md](/Users/easton/Codex Creator Challenge/DEPLOYMENT.md) for the full deployment steps.

