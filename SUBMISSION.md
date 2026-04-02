# ClipMine AI Submission Package

## Title Options

- ClipMine AI
- ClipMine AI: Training-Ready Speech Clips
- ClipMine AI: Curate Better Speech Data Faster

## Final Contest Description

ClipMine AI uploads real-world video, finds the best short speech moments, scores each clip for training usefulness, visualizes strong and weak regions on a timeline, and exports structured JSON for downstream multimodal annotation and dataset prep.

## One-Sentence Pitch

Upload any video and instantly find, visualize, and export the best training-ready speech clips.

## What The Project Does

- Accepts `.mp4` and `.mov` uploads
- Extracts and transcribes speech with timestamps
- Builds candidate 1 to 3 second clips
- Scores clips for confidence, pace, signal strength, silence, and stability
- Surfaces ranked clips, a usefulness timeline, and JSON export

## Why It Was Built

ML teams often start from messy, long-form video but need short, clean speech examples for labeling, curation, and dataset construction. ClipMine AI reduces the manual screening step and turns a raw source video into an explorable clip set.

## How It Was Built

- Next.js 16 App Router frontend
- FastAPI backend
- `imageio-ffmpeg` for bundled ffmpeg extraction
- `faster-whisper` on CPU for transcription
- File-backed job manifests and artifacts
- Timeline and export serialization for downstream tooling

## Demo Outline

1. Open the landing page and state the value prop in one sentence.
2. Upload a short talking-head video.
3. Show the live processing phases in the job workspace.
4. Open `Best Clips` and click through the top-ranked moments.
5. Open `Timeline` and jump to a strong region in the source video.
6. Open `Export` and download the structured JSON file.

