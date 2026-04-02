# AGENT.md

## Project Rules

- Keep the product focused on clip curation, not raw transcript browsing.
- Preserve the split architecture: Next.js frontend, FastAPI backend, file-backed storage.
- Do not introduce a database unless the file-backed job model becomes a proven blocker.
- Keep scoring transparent and human-explainable.
- Prefer stable CPU-first media/transcription paths over clever but brittle optimizations.

## Local Commands

- Frontend install: `npm_config_cache=/tmp/clipmine-npm-cache npm install`
- Frontend dev: `npm run dev:web`
- Frontend checks: `npm run lint:web` and `npm run build:web`
- Backend setup: `pip install -e ".[dev]"` from `backend/`
- Backend dev: `uvicorn clipmine_api.main:app --reload --port 8000`
- Backend tests: `pytest`

## Code Style

- Keep modules small and behavior-oriented.
- Add comments only when the intent is not obvious from the code.
- Prefer plain TypeScript and Python over framework-heavy abstractions.

