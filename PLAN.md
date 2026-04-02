# ClipMine AI Plan

> Global operating prompt:
> Every time you open this file, add at least one new task before doing anything else. Then mark completed work, record new bugs, record anything that still needs testing, pick one unchecked task, implement it, verify it, push it to GitHub, reopen this file, add another task, and continue. Do not silently drop old tasks. Check them off and leave a short note instead.

## Working Rules

1. Add at least one new task on every read of this plan.
2. Mark completed tasks with the date and the commands used to verify them.
3. Add every bug found to `Bugs found`.
4. Add every unverified edge case to `Needs testing`.
5. After completing one task, push to GitHub before taking the next one.
6. Prefer additive changes. Do not break upload, review, timeline, or export.
7. Keep frontend and backend tasks separate so the next action is obvious.

## Current Project Goals

- Shorten the path from raw talking-head footage to usable speech data.
- Help users review stronger clips first instead of scrubbing raw video manually.
- Keep ranking explainable with human-readable reasoning and machine-readable metrics.
- Export training-ready media packages with linked metadata and stable file naming.
- Support both single uploads and higher-throughput batch review sessions.
- Keep the stack deployable and reliable in local and production modes.

## Current Snapshot

- Frontend: Next.js App Router, Tailwind, SWR, Framer Motion.
- Backend: FastAPI, ffmpeg, faster-whisper, file-backed jobs, optional S3 multipart upload flow.
- Current main workflows:
  - single upload -> job workspace
  - batch queue upload -> batch workspace
  - clip review -> selection -> zip export
  - full-job export -> `export.json`

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

## Bugs Found

- [ ] Node still prints `NO_COLOR` / `FORCE_COLOR` warnings during Playwright startup even though the suite passes.
- [ ] The workspace-local `.git` directory in the main repo root is not trustworthy for normal commit workflows, so publish still uses the temp-checkout workaround.

## Needs Testing

- [ ] Real-world batch queue with at least 3 medium-size videos against the live backend, not mocked browser routes.
- [ ] Multi-part upload retry behavior across a flaky network path.
- [ ] Batch export with one failed source and one ready source in the same session.
- [ ] Large-file runtime timing comparison between direct and multipart uploads using a source larger than 1 GB.
- [ ] Package export correctness for S3-backed source playback and trimming.

## Milestones

### Phase 1: Core intake and processing

- [x] Single upload flow
- [x] Direct backend processing
- [x] Ranked clips and timeline
- [x] Raw JSON export

### Phase 2: Review workflow

- [x] Filters, shortlist, selected clip panel
- [x] URL-driven workspace state
- [x] Batch clip package export
- [x] Batch workspace and threshold export

### Phase 3: Reliability

- [x] Multipart upload mode
- [x] Corrupted media handling
- [x] Local Playwright recovery
- [ ] Resume multipart uploads across browser restarts
- [ ] Stronger object-storage health reporting in deployment environments

### Phase 4: Product polish

- [x] Premium dark app shell
- [x] README visuals and generated assets
- [ ] Better live queue guidance for large batch uploads
- [ ] Side-by-side shortlist comparison
- [ ] Export preset options beyond JSON + zip

## Frontend Tasks

- [x] Improve live batch queue status
  Prompt: "Rework the landing upload progress area so multi-file queues clearly show the current source, queue position, waiting count, backend-ready count, and failed count while uploads are in flight."
  Notes: Added on 2026-04-02 and completed in the same pass.
  Verified: `npm run test:e2e`, `npm run test:web`, `npm run build:web`

- [ ] Add per-job retry from batch workspace
  Prompt: "Let users retry a failed source from the batch workspace instead of forcing them back to the landing page."

- [ ] Add side-by-side shortlisted clip comparison
  Prompt: "Build a compact comparison mode for two shortlisted clips so users can inspect transcript, metrics, and recommendation differences without switching context."

- [ ] Add export preset selector
  Prompt: "Extend the export panel with presets like full AV package, audio-only package, and metadata-only package while keeping the current zip export as the default."

- [x] Add queue completion toast and summary state
  Prompt: "When a batch queue finishes, show a stronger completion summary before navigating so the user understands how many sources succeeded or failed."
  Notes: Added on 2026-04-02 and completed in the same pass. The landing page now stops on a finished-state summary with success / failure counts and a direct button into the batch workspace.
  Verified: `npm run test:web`, `npm run lint:web`, `npm run build:web`, `npm run test:e2e`

- [ ] Surface the latest finished batch session from the landing page
  Prompt: "Add a compact landing shortcut for the most recently completed batch session so users can reopen it without re-queueing the same sources."

- [ ] Add per-source ETA hints to the active queue card
  Prompt: "Estimate queue progress for the current source and remaining queue so large multi-file uploads feel less opaque while the active transfer is running."

## Backend Tasks

- [ ] Resume multipart uploads across browser refresh
  Prompt: "Persist active upload sessions strongly enough that the frontend can resume a multipart transfer after a refresh when the session is still valid."

- [ ] Add audio-only export companion
  Prompt: "Support an optional audio-only export path that trims `.wav` files alongside the existing mp4 package structure."

- [ ] Add batch export partial-failure manifest warnings
  Prompt: "If some selected jobs fail during combined export, preserve successful jobs in the archive and record the failed jobs in the manifest warnings."

- [ ] Add object-storage playback verification endpoint
  Prompt: "Expose a lightweight diagnostic path or health detail that confirms remote source playback reads are working end to end."

## Testing Tasks

- [ ] Remove Playwright color warnings
  Prompt: "Trace the remaining `NO_COLOR` / `FORCE_COLOR` conflict during Playwright startup and eliminate the warnings without breaking the local browser test path."

- [ ] Add non-mocked browser verification against the local API
  Prompt: "Create a dedicated Playwright job that talks to the real local FastAPI backend for one smoke path instead of mocking every API response."

- [ ] Add regression coverage for batch queue cancellation
  Prompt: "Cover the batch queue cancellation path with a browser test that asserts current source state, queue counters, and the retryable cancellation message."

- [ ] Add large-file benchmark harness
  Prompt: "Create a repeatable local benchmark script that measures transfer time, transcription time, and package-export time for larger fixture files."

## Docs and Ops Tasks

- [ ] Link this plan from the repo docs more prominently
  Prompt: "Make the active implementation plan discoverable from the README and agent guidance without cluttering the landing narrative."

- [ ] Document temp-checkout git publishing workaround
  Prompt: "Record the current workaround for publishing when the workspace-local `.git` is unusable so the next agent does not rediscover it from scratch."

## Session Ledger

- 2026-04-02: Added `Improve live batch queue status` and completed it in the same pass.
- 2026-04-02: Added `Add queue completion toast and summary state` as the next follow-on frontend task.
- 2026-04-02: Added `Remove Playwright color warnings` after re-reading the plan during verification cleanup.
- 2026-04-02: Added `Surface the latest finished batch session from the landing page` before implementing the queue completion summary flow.
- 2026-04-02: Completed `Add queue completion toast and summary state` after web unit, lint, build, and Playwright verification.
- 2026-04-02: Added `Add per-source ETA hints to the active queue card` as the next frontend queue follow-up.
