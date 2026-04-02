# ClipMine AI Submission Notes

## Title Options

- ClipMine AI
- ClipMine AI: Training-Ready Speech Clips
- ClipMine AI: Find the Best Speech Moments Fast

## Contest Description

ClipMine AI uploads real-world video, extracts the strongest short speech segments, scores each clip for training usefulness, visualizes signal quality on a timeline, and exports clean JSON for downstream multimodal annotation and dataset workflows.

## What It Does

- Uploads `.mp4` and `.mov` video
- Transcribes speech with timestamps
- Segments candidate 1 to 3 second clips
- Scores clips for confidence, pace, signal quality, and continuity
- Surfaces the best moments in a ranked UI and timeline
- Exports structured JSON

## Why It Was Built

Researchers and ML developers often need clean speech examples but start with noisy real-world video. ClipMine AI reduces the manual triage step and makes promising training clips immediately explorable.

## How It Was Built

- Next.js 16 App Router frontend
- FastAPI backend
- `imageio-ffmpeg` media extraction
- `faster-whisper` CPU transcription
- Disk-backed processing jobs and JSON exports

## One-Sentence Pitch

Upload any video and instantly find, visualize, and export the best training-ready speech clips.

## Demo Outline

1. Open the landing page and state the problem in one sentence.
2. Upload a short talking-head video.
3. Watch the processing states move from upload to ranked clips.
4. Open the best clips tab and show score explanations.
5. Switch to timeline view and click a strong region.
6. Download the JSON export and show the schema.

