# ClipMine AI

> Upload a talking-head video and instantly surface the best training-ready speech clips.

ClipMine AI is a training-signal curation tool for multimodal speech data. Upload a talking-head video, let the system segment and score the strongest short speech moments, then review them through ranked clips, a full-video usefulness timeline, and export-ready structured data.

## Why This Exists

Raw transcripts are noisy. Raw video is slow to review. Most dataset builders need something in the middle: short, well-scored speech clips that are already filtered for confidence, pace, signal quality, and continuity. ClipMine AI is built for that curation step.

## Who It Is For

- ML engineers and researchers curating multimodal speech datasets
- Developers building annotation or training-data pipelines
- Students and small teams who need clean, explainable short speech clips from messy real-world video

## Project Goals

- Reduce manual review time for talking-head source video
- Surface the most training-ready speech clips instead of raw transcript dumps
- Keep clip quality transparent with human-readable scores and explanations
- Preserve structured output that is immediately useful for annotation and dataset workflows

## Implemented Today

### Product Experience

- Upload `.mp4` and `.mov` files through a direct local upload flow or a production multipart object-storage flow
- Support large source uploads up to `1 GB` by default
- Move each upload into a persistent workspace URL for processing and review
- Review ranked clips, a usefulness timeline, and JSON export from the same workspace

### Processing Pipeline

- Extract mono `16 kHz` audio with a bundled ffmpeg binary
- Transcribe speech with `faster-whisper`
- Segment candidate clips around the `1` to `3` second range with filler trimming and boundary checks
- Score clips for confidence, pace, energy, silence, stability, boundary cleanliness, and speech density
- Deduplicate near-overlapping clips so weaker repeats do not crowd out cleaner selections
- Generate human-readable quality labels, penalties, and shortlist/review/discard recommendations for each clip

### Review And Export

- Rank clips by training usefulness
- Visualize the full source video with a `48`-bin usefulness timeline
- Filter clips by transcript text, quality label, recommendation, penalty/tag signal, and sort order
- Keep a local shortlist of pinned clips and reopen recent jobs from the landing page
- Batch select clips separately from the shortlist while reviewing
- Keep source playback aligned with timestamps from the ranking output
- Export structured JSON for annotation or dataset curation workflows
- Export a selected training package as one zip archive with:
  - trimmed `.mp4` clip files
  - stable `clip_<ordinal>__<clipId>.mp4` naming
  - `manifest.json` linking each file back to clip metadata
- Extend every clip with candidate metrics, multimodal features, quality penalties, and selection recommendation metadata

## Upcoming Features

- [ ] Resume multipart uploads across full browser restarts
- [ ] Split processing into a separate worker queue once throughput pressure justifies it
- [ ] Richer export presets with optional CSV and more processing metadata
- [ ] Stronger production observability and workflow analytics
- [ ] Workspace comparison tools for evaluating multiple shortlisted clips side by side
- [ ] Optional embedding generation from a dedicated production embedding model instead of the current nullable placeholder field

## Architecture

- `apps/web`: Next.js 16 App Router frontend with Tailwind CSS, SWR, and Framer Motion
- `backend`: FastAPI processing API with a disk-backed job store and optional S3-compatible source-video storage
- `backend/src/clipmine_api/media.py`: ffmpeg-based audio extraction and media probing
- `backend/src/clipmine_api/transcription.py`: CPU transcription via `faster-whisper`
- `backend/src/clipmine_api/segmentation.py`: candidate clip building from timestamped words
- `backend/src/clipmine_api/scoring.py`: transparent training-usefulness scoring
- `backend/src/clipmine_api/precision.py`: overlap dedupe and selection recommendation logic
- `backend/src/clipmine_api/presentation.py`: summary, timeline, and export serialization

The frontend talks directly to the backend API for upload session creation, polling, video playback, and export. Local development keeps a direct upload path for simplicity. Production deployments can switch to multipart uploads backed by S3-compatible object storage while the backend continues to own job orchestration, processing, and same-origin playback.

## Scoring Model

Each clip receives:

- `confidence`: mean word-level transcription confidence
- `speech_rate`: words per second
- `energy`: normalized RMS energy inside the source audio
- `silence_ratio`: share of low-energy frames inside the clip
- `instability`: how uneven the signal is across the clip
- `candidate_metrics`: pause count, max gap, speech density, low-confidence span ratio, edge filler ratios, and punctuation strength
- `selection_recommendation`: `shortlist`, `review`, or `discard`
- `quality_penalties`: machine-readable reasons like `boundary_messy` or `duplicate_overlap`
- `score`: final score from `0` to `100`
- `quality_label`: `Excellent`, `Good`, or `Weak`
- `explanation`: short human-readable rationale

Score model:

```text
score = clamp(
  100 * (
    0.34*confidence
    + 0.18*pace_fit
    + 0.16*energy_norm
    + 0.10*continuity
    + 0.10*boundary_cleanliness
    + 0.08*speech_density
    + 0.04*lexical_clarity
  )
  - 15*silence_ratio
  - 8*instability
  - 6*edge_filler_penalty
  - 7*low_confidence_penalty
  - 5*duration_penalty
  - duplicate_penalty,
  0,
  100
)
```

Where `pace_fit` favors roughly `2.2` to `3.8` words per second, `continuity = 1 - silence_ratio`, and a second precision pass removes or downgrades near-duplicate, filler-heavy, and boundary-messy clips.

## Repository Layout

```text
.
├── apps/web
├── backend
├── .github/workflows
├── AGENT.md
├── DEPLOYMENT.md
├── SUBMISSION.md
└── render.yaml
```

## Local Setup

### 1. Configure Environment

Copy `.env.example` to `.env` at the repo root and adjust values if needed.

Important defaults:

- `NEXT_PUBLIC_MAX_UPLOAD_MB=1024`
- `NEXT_PUBLIC_UPLOAD_MODE=direct`
- `LOG_LEVEL=DEBUG`
- `MAX_UPLOAD_MB=1024`
- `BACKEND_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`

### 2. Install Frontend Dependencies

The npm cache on this machine needs an alternate path:

```bash
npm_config_cache=/tmp/clipmine-npm-cache npm install
```

### 3. Install Backend Dependencies

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cd ..
```

### 4. Run Both Services

Backend:

```bash
npm run dev:api
```

Frontend:

```bash
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000).

## Root Commands

```bash
npm run dev:web
npm run build:web
npm run start:web
npm run lint:web
npm run dev:api
npm run test:api
npm run test:web
npm run test:e2e
```

## Verification Commands

Frontend:

```bash
npm run lint:web
npm run build:web
npm run test:web
npm run preview:web
```

Browser smoke coverage:

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npm run test:e2e
```

Backend:

```bash
npm run test:api
```

Verbose backend request and processing logs are enabled by default in local development with `LOG_LEVEL=DEBUG`.
In this current macOS sandbox, Playwright browser launch can fail before page code runs. The smoke suite is included in the repo and should run normally in CI or a less restricted local environment.

## How To Use The App

1. Open the landing page.
2. Upload a `.mp4` or `.mov` video with speech.
   Large uploads up to `1 GB` are supported by default.
   Local development uses direct uploads by default. Production deployments should use multipart object-storage uploads.
3. Wait while the backend moves through audio extraction, transcription, segmentation, and scoring.
4. Review the ranked clips in `Best clips`.
5. Inspect strong and weak regions in `Timeline`.
6. Select the clips you want to keep for training prep.
7. Download either:
   - `selected package` for clip files + manifest
   - `export.json` for the full raw job payload

## What Makes The Project Useful

- It focuses on curation, not just transcription display
- The scoring model is transparent and easy to explain
- The timeline helps users inspect the whole source video quickly
- The export keeps clip data structured for downstream workflows

## Local Smoke Test

The backend has been verified against a generated test video:

- Upload succeeded
- Processing reached `ready`
- 4 clips were ranked

## Production Upload Path

ClipMine now supports two upload transports:

- `direct`: browser sends the file to `POST /api/jobs`
- `multipart`: browser requests signed part URLs from the backend, uploads chunks directly to object storage, then calls `complete`

Use `NEXT_PUBLIC_UPLOAD_MODE=direct` for local development and `NEXT_PUBLIC_UPLOAD_MODE=multipart` with `STORAGE_BACKEND=s3` for production deployments.
- Timeline bins were generated
- Export payload shape was returned

If you want to recreate that manually on macOS:

```bash
say -v Samantha "Hello there. This is a short test video for ClipMine AI." -o /tmp/clipmine-test.aiff
FFMPEG=$(cd backend && source .venv/bin/activate && python -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')
"$FFMPEG" -y -f lavfi -i color=c=0x111111:s=1280x720:d=8 -i /tmp/clipmine-test.aiff -shortest -c:v libx264 -pix_fmt yuv420p /tmp/clipmine-test.mp4
```

Then upload `/tmp/clipmine-test.mp4` through the UI.

## Deployment

- Frontend: Vercel
- Backend: Render Web Service with a persistent disk

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the exact steps.
