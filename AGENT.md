# AGENT.md

## Project Intent

ClipMine AI is not a transcript browser and not a generic exporter. Keep the product centered on finding training-ready speech clips from noisy real-world video.

## Product Guardrails

- Preserve the split architecture: Next.js frontend, FastAPI backend.
- Keep local development simple, but prefer S3-compatible object storage for production uploads.
- Keep scoring transparent and explainable. Avoid fake research language.
- Do not add auth, team features, or a database in v1.
- Use one shared source video player in the workspace rather than detached clip video files.

## Important Interfaces

- `POST /api/jobs`
- `POST /api/uploads/init`
- `POST /api/uploads/{uploadSessionId}/complete`
- `DELETE /api/uploads/{uploadSessionId}`
- `GET /api/jobs/{jobId}`
- `GET /api/jobs/{jobId}/video`
- `GET /api/jobs/{jobId}/export.json`

The frontend expects top-level camelCase fields such as `jobId`, `progressPhase`, and `sourceVideo`. Clip and timeline records are snake_case.
Local development defaults to direct uploads. Production deployments should use `NEXT_PUBLIC_UPLOAD_MODE=multipart` with `STORAGE_BACKEND=s3`.

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

Browser smoke tests:

```bash
npm run test:e2e
```

## Git Publishing Note

- The workspace-local `.git` may be unusable in this environment. If normal staging fails, use a clean temp checkout of `origin/main`, copy the changed tracked files into that checkout, then commit and push from there.
- Before staging in the temp checkout, always run:

```bash
git fetch origin
git checkout main
git reset --hard origin/main
```

- The README asset workflow can land follow-up commits on `main`, so do not assume the temp checkout is still current between tasks.
- If HTTPS push hangs on the macOS keychain helper, run:

```bash
gh auth setup-git
```

- After that, retry `git push origin main` from the temp checkout.

## Code Guidance

- Prefer maintainable modules over framework-heavy abstractions.
- Add comments only when the reasoning is not obvious.
- Keep upload validation, scoring, and serialization logic explicit.
- If you change the response shape, update both `apps/web/src/lib/types.ts` and the backend serializer functions.
