# AGENT.md

## Project Intent

ClipMine AI is not a transcript browser and not a generic exporter. Keep the product centered on finding training-ready speech clips from noisy real-world video.

## Product Guardrails

- Preserve the split architecture: Next.js frontend, FastAPI backend.
- Keep storage file-backed unless a real scaling need appears.
- Keep scoring transparent and explainable. Avoid fake research language.
- Do not add auth, team features, or a database in v1.
- Use one shared source video player in the workspace rather than detached clip video files.

## Important Interfaces

- `POST /api/jobs`
- `GET /api/jobs/{jobId}`
- `GET /api/jobs/{jobId}/video`
- `GET /api/jobs/{jobId}/export.json`

The frontend expects top-level camelCase fields such as `jobId`, `progressPhase`, and `sourceVideo`. Clip and timeline records are snake_case.

## Local Commands

Frontend install:

```bash
npm_config_cache=/tmp/clipmine-npm-cache npm install
```

Frontend checks:

```bash
npm run lint:web
npm run build:web
```

Backend setup:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Backend checks:

```bash
npm run test:api
```

## Code Guidance

- Prefer maintainable modules over framework-heavy abstractions.
- Add comments only when the reasoning is not obvious.
- Keep upload validation, scoring, and serialization logic explicit.
- If you change the response shape, update both `apps/web/src/lib/types.ts` and the backend serializer functions.
