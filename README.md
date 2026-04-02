# ClipMine AI

ClipMine AI is a training-signal curation tool for multimodal speech data. Upload a talking-head video, let the backend transcribe and segment it, then inspect the strongest short speech moments through ranked clips, a usefulness timeline, and export-ready JSON.

## Why This Exists

Raw transcripts are noisy. Raw video is slower. Dataset builders usually need something in the middle: short clips that are already filtered for transcription confidence, signal quality, moderate pace, and continuity. ClipMine AI is built for that curation step.

## What The App Does

- Accepts `.mp4` and `.mov` uploads
- Extracts mono 16 kHz audio with a bundled ffmpeg binary
- Transcribes speech with `faster-whisper`
- Segments candidate clips around the 1 to 3 second range
- Scores each clip for confidence, pace, energy, silence, and stability
- Ranks clips with human-readable explanations
- Visualizes usefulness across the source video with a 48-bin timeline
- Exports structured JSON for annotation or dataset workflows

## Architecture

- `apps/web`: Next.js 16 App Router frontend with Tailwind CSS, SWR, and Framer Motion
- `backend`: FastAPI processing API with a disk-backed job store
- `backend/src/clipmine_api/media.py`: ffmpeg-based audio extraction and media probing
- `backend/src/clipmine_api/transcription.py`: CPU transcription via `faster-whisper`
- `backend/src/clipmine_api/segmentation.py`: candidate clip building from timestamped words
- `backend/src/clipmine_api/scoring.py`: transparent training-usefulness scoring
- `backend/src/clipmine_api/presentation.py`: summary, timeline, and export serialization

The frontend talks directly to the backend API for upload, polling, video playback, and export. Local storage keeps the stack simple and reliable for a demo build.

## Scoring Model

Each clip receives:

- `confidence`: mean word-level transcription confidence
- `speech_rate`: words per second
- `energy`: normalized RMS energy inside the source audio
- `silence_ratio`: share of low-energy frames inside the clip
- `instability`: how uneven the signal is across the clip
- `score`: final score from `0` to `100`
- `quality_label`: `Excellent`, `Good`, or `Weak`
- `explanation`: short human-readable rationale

Score formula:

```text
score = clamp(
  100 * (0.45*confidence + 0.20*pace_fit + 0.20*energy_norm + 0.15*continuity)
  - 15*silence_ratio
  - 8*instability
  - 5*duration_penalty,
  0,
  100
)
```

Where `pace_fit` favors roughly `2.2` to `3.8` words per second and `continuity = 1 - silence_ratio`.

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

## Verification Commands

Frontend:

```bash
npm run lint:web
npm run build:web
npm run preview:web
```

Backend:

```bash
cd backend
source .venv/bin/activate
pytest
```

## How To Use The App

1. Open the landing page.
2. Upload a `.mp4` or `.mov` video with speech.
3. Wait while the backend moves through audio extraction, transcription, segmentation, and scoring.
4. Review the ranked clips in `Best Clips`.
5. Inspect strong and weak regions in `Timeline`.
6. Download `export.json` from `Export`.

## Local Smoke Test

The backend has been verified against a generated test video:

- Upload succeeded
- Processing reached `ready`
- 4 clips were ranked
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

See [DEPLOYMENT.md](/Users/easton/Codex Creator Challenge/DEPLOYMENT.md) for the exact steps.
