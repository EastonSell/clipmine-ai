# ClipMine AI Production Release Checklist

## Overview

This document tracks what remains to make ClipMine AI production-ready for release. It is a static checklist for finishing the product, fixing release-blocking issues, and completing the validation required before launch.

## Release Criteria

ClipMine AI is production-ready when all of the following are true:

- Single-source uploads are stable in supported environments.
- Batch uploads handle success, failure, cancellation, and recovery without stranding the user.
- Review workspaces, playback, and export flows work reliably for both single jobs and batch sessions.
- Deployment diagnostics clearly report object-storage and playback health.
- No critical known bugs remain open.
- Automated checks pass:
  - `npm run test:web`
  - `npm run test:api`
  - `npm run build:web`
  - `npm run test:e2e`
- Required live and manual validation has been completed.

## Current Project Goals

- Shorten the path from raw talking-head footage to usable speech data.
- Help users review the strongest clips first instead of scrubbing raw video manually.
- Keep ranking explainable with human-readable reasoning and machine-readable metrics.
- Export training-ready media packages with linked metadata and stable file naming.
- Support both single uploads and higher-throughput batch review sessions.
- Keep the stack deployable and reliable in local and production environments.

## Implemented Features

| Area | Implemented | Tested |
| --- | --- | --- |
| Single `.mp4` / `.mov` upload | Yes | `npm run test:api`, `npm run test:e2e` |
| Multipart upload mode | Yes | `npm run test:api`, `npm run test:e2e` |
| Batch queue upload | Yes | `npm run test:e2e` |
| Ranked clip review | Yes | `npm run test:web`, `npm run test:e2e` |
| Timeline view | Yes | `npm run test:e2e` |
| Selected clip package export | Yes | `npm run test:api`, `npm run test:e2e` |
| Batch threshold export | Yes | `npm run test:e2e` |
| Multimodal clip schema | Yes | `npm run test:api` |
| Corrupted media handling | Yes | `npm run test:api`, runtime smoke |
| Local Playwright browser coverage | Yes | `npm run test:e2e` |

## Bugs to Fix

- [ ] Resolve the unreliable workspace-local `.git` behavior so normal commit workflows do not require the temp-checkout workaround.

## Must Be Tested Before Release

- [ ] Run a real-world batch queue with at least three medium-size videos against the live backend without mocked browser routes.
- [ ] Verify multipart upload retry behavior across a flaky network path.
- [ ] Verify batch export behavior when one source fails and one source is ready in the same session.
- [ ] Compare large-file runtime timing for direct and multipart uploads using a source larger than 1 GB.
- [ ] Verify package export correctness for S3-backed source playback and trimming.

## Remaining Tasks

### Frontend

- [ ] Improve live queue guidance for large batch uploads.
- [ ] Add per-job retry from the batch workspace.
- [ ] Add side-by-side shortlisted clip comparison.
- [ ] Add an export preset selector for package outputs beyond the current default zip flow.
- [ ] Add a dismiss action for stale finished batch shortcuts.
- [ ] Add per-source ETA hints to the active queue card.

### Backend

- [ ] Resume multipart uploads across browser refresh or restart.
- [ ] Strengthen object-storage health reporting in deployment environments.
- [ ] Add an audio-only export companion.
- [ ] Add batch export partial-failure manifest warnings.
- [ ] Add an object-storage playback verification endpoint.

### Testing

- [ ] Add a smoke assertion for the finished batch summary action row.
- [ ] Add a console-warning guard around the browser smoke runner.
- [ ] Add non-mocked browser verification against the local API.
- [ ] Add regression coverage for batch queue cancellation.
- [ ] Add a large-file benchmark harness.

### Docs / Ops

- [ ] Link this plan more prominently from the repo docs.
- [ ] Document README asset workflow churn on `main`.
