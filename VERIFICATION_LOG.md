# Verification Log

## Batch Aggregate Contribution Sort Pass

Date: 2026-04-03

- Sorted the ready-source rows in the batch aggregate export summary by current eligible-duration contribution so the largest download drivers surface first when the threshold changes.
- Added a stable tiebreak sequence that falls back to eligible clip count and then the original ready-source order so tied contributions do not reshuffle unpredictably.
- Extended the existing batch export Playwright scenario so it asserts the summary order at balanced, strict, and broad thresholds, which covers both dominant-source and tied-source states.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted lint and Playwright commands could run.

### Checks run

```bash
npm ci
npm run lint:web -- --file src/components/batch/batch-workspace.tsx
npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"
```

### Result

- targeted frontend lint passed
- `1 / 1` targeted Playwright batch export tests passed
- ready-source aggregate rows now reorder with the current contribution while ties stay stable

## Batch Aggregate Contribution Bars Pass

Date: 2026-04-03

- Replaced the text-only eligible-duration share badge in the ready-source aggregate export summary with labeled contribution bars so reviewers can spot dominant download contributors at a glance.
- Kept the displayed percentage and the new bar width derived from the same eligible-duration share calculation, and added explicit progress-bar labels so the browser test can assert the visual contribution values directly.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted lint and Playwright commands could run.

### Checks run

```bash
npm ci
npm run lint:web -- --file src/components/batch/batch-workspace.tsx --file src/components/ui/progress-bar.tsx
npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"
```

### Result

- targeted frontend lint passed
- `1 / 1` targeted Playwright batch export tests passed
- ready-source aggregate rows now show contribution bars aligned with the existing eligible-duration percentages

## Batch Aggregate Eligible Duration Pass

Date: 2026-04-03

- Added a per-source eligible-duration total to the ready-source aggregate export summary so the current thresholded download value is visible beside each source's clip count.
- Kept the new duration badge derived from the same filtered clip set as the aggregate selection, which keeps the source rows synchronized as reviewers switch thresholds.
- Extended the existing batch export Playwright scenario so it asserts the per-source duration totals at the balanced, strict, and broad thresholds already covered by the export flow.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted Playwright command could run.

### Checks run

```bash
npm ci
npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"
```

### Result

- `1 / 1` targeted Playwright batch export tests passed
- ready-source aggregate rows now expose both eligible clip counts and eligible duration before export
- threshold changes keep the per-source duration totals aligned with the active batch selection
## Batch Aggregate Source Jump Pass

Date: 2026-04-03

- Added a focused inspect action to each ready-source row in the aggregate export summary so reviewers can jump directly into that source from the export card before downloading.
- Kept the action wired to the existing selected-source state instead of navigating away, and highlighted the currently selected source inside the summary so the export view stays oriented after each jump.
- Extended the existing batch export Playwright scenario so it proves the summary actions can switch the selected source to both `beta.mp4` and back to `alpha.mp4` before the threshold and export assertions continue.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the repo-local lint and Playwright commands could run.

### Checks run

```bash
npm ci
npm run lint:web -- --file src/components/batch/batch-workspace.tsx
npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"
```

### Result

- targeted frontend lint passed
- `1 / 1` targeted Playwright batch export tests passed
- reviewers can now jump from the aggregate export summary into the corresponding batch source before downloading

## Saved Batch Retry Persistence Pass

Date: 2026-04-03

- Persisted queued batch source files into an IndexedDB-backed browser cache so failed uploads can survive a full reload before they are retried from the batch workspace.
- Updated the batch workspace retry flow to hydrate cached-source availability asynchronously from browser storage, reuse the stored source when retrying a failed item without a prior `jobId`, and clear the cached file again once the retry reaches backend processing.
- Extended the focused Playwright retry scenario so it reloads the landing page, reopens the saved batch workspace, and proves the failed source still upgrades into a new job.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted checks could run.

### Checks run

```bash
npm ci
npm run build:web
npm run test:e2e -- --grep "saved batch workspace retries a failed source after reload"
```

### Result

- production web build passed
- `1 / 1` targeted Playwright saved-batch retry tests passed
- failed batch items can now be retried after a full reload as long as browser source persistence succeeds

## Batch Threshold Preset Count Labels Pass

Date: 2026-04-03

- Added a small batch-threshold helper that counts how many clips clear any requested score floor across the currently loaded batch jobs.
- Updated the aggregate export quick-preset buttons to show live eligible clip totals for Strict, Balanced, and Broad so reviewers can compare the export tradeoff before switching thresholds.
- Extended the existing batch export Playwright scenario so it asserts the annotated preset counts alongside the current threshold URL and export-preset behavior.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted checks could run.

### Checks run

```bash
npm ci
npm run test:web -- --run src/lib/batch-focus.test.ts
env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright test --grep "batch workspace groups jobs and exports thresholded clips"
```

### Result

- `13 / 13` targeted batch-focus unit tests passed
- `1 / 1` targeted Playwright batch export tests passed
- batch reviewers can now compare preset tradeoffs from the button labels before changing the score floor

## Batch Threshold Quick Presets Pass

Date: 2026-04-03

- Added shared Strict, Balanced, and Broad batch-threshold presets around the existing default score floor so the batch workspace can expose consistent one-click review jumps.
- Updated the batch aggregate export card to render quick preset buttons beside the slider, keep their pressed state synchronized with the current threshold, and clear stale export errors when reviewers switch floors from either control.
- Extended the focused batch export Playwright scenario so it proves the quick preset buttons rewrite the batch workspace URL and move the visible threshold before the existing slider and preset-export coverage continues.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted checks could run.

### Checks run

```bash
npm ci
npm run test:web -- --run src/lib/batch-focus.test.ts
npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"
```

### Result

- `12 / 12` targeted batch-focus unit tests passed
- `1 / 1` targeted Playwright batch export tests passed
- batch reviewers can now jump between common score floors without dragging the range input

## Batch Quality Threshold URL Pass

Date: 2026-04-03

- Added a validated `threshold` query param to the batch workspace URL helper so shared batch review links can preserve the active score floor alongside the existing triage, selected-job, and export-preset state.
- Updated the batch App Router page to parse the incoming threshold from `searchParams` and seed the client workspace with that value before any saved batch-session fallback is applied.
- Extended the focused batch export Playwright scenario so it proves `threshold=90` survives reloads and direct route visits even when saved session storage is temporarily forced back to a different threshold.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted checks could run.

### Checks run

```bash
npm ci
npm run test:web -- --run src/lib/batch-focus.test.ts
npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"
```

### Result

- `11 / 11` targeted batch-focus unit tests passed
- `1 / 1` targeted Playwright batch export tests passed
- bookmarked batch review links now reopen the same score floor even when saved session state disagrees

## Batch Export Preset URL Pass

Date: 2026-04-03

- Added a normalized `preset` query param to the batch workspace URL helper so export-mode links can preserve the active preset alongside the existing triage and selected-job state.
- Updated the batch App Router page to parse the incoming preset from `searchParams` and seed the client workspace with that value before any saved batch-session fallback is applied.
- Extended the focused batch export Playwright scenario so it proves `preset=audio-only` survives reloads and re-opened route visits even when saved session storage is temporarily forced back to `full-av`.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted checks could run. The local Playwright browser bundle also needed a one-time `npx playwright install chromium` into the shared cache path.

### Checks run

```bash
npm ci
npm run test:web -- --run src/lib/batch-focus.test.ts
env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright install chromium
env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright test --grep "batch workspace groups jobs and exports thresholded clips"
```

### Result

- `10 / 10` targeted batch-focus unit tests passed
- `1 / 1` targeted Playwright batch export tests passed
- bookmarked batch preset links now reopen the same export mode even when saved session state disagrees

## Batch Export Preset Persistence Pass

Date: 2026-04-03

- Persisted the batch aggregate export preset in the saved batch-session record so refreshes and reopened saved sessions restore the last selected mode instead of defaulting back to full AV.
- Hydrated the batch workspace preset state from storage on load and kept the existing aggregate export preview and download request synchronized with the stored value.
- Extended the focused Playwright batch-export scenario to prove the preset survives a browser reload and leaving/reopening the saved batch workspace, while updating the test seed so reloads no longer wipe the persisted local session state.
- This checkout started without frontend dependencies installed, so `npm ci` was required before verification. The fresh checkout also needed a one-time `npx playwright install chromium` into the shared Playwright cache path before the targeted browser spec could run.

### Checks run

```bash
npm ci
env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright install chromium
npm run test:web -- --run src/lib/batch-sessions.test.ts
env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright test --grep "batch workspace groups jobs and exports thresholded clips"
```

### Result

- `5 / 5` targeted batch-session unit tests passed
- `1 / 1` targeted Playwright batch export tests passed
- reload and reopen coverage now proves the saved batch preset survives beyond the original tab view

## Batch Queue ETA Hints Pass

Date: 2026-04-03

- Added a focused batch-upload ETA helper that estimates the current source handoff time from live progress and reuses completed-source timings to forecast the rest of the queue once earlier uploads finish.
- Surfaced `This source ETA` and `Queue intake ETA` hints inside the landing-page current-source card, with copy that makes it explicit these estimates only cover upload intake and not the later backend processing steps.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted verification commands could run.
- A full `npm run lint:web` still reports an existing unrelated `react-hooks/exhaustive-deps` warning in `apps/web/src/components/batch/batch-workspace.tsx`, so this pass used a targeted `eslint` run on the changed files instead of claiming repo-wide lint was green.

### Checks run

```bash
npm ci
npm run test:web -- --run src/lib/batch-upload-eta.test.ts
cd apps/web && npx eslint src/components/landing/upload-section.tsx src/lib/batch-upload-eta.ts src/lib/batch-upload-eta.test.ts --max-warnings=0
```

### Result

- `4 / 4` targeted web ETA tests passed
- targeted frontend lint passed for the changed files

## Batch Export Preset Selector Pass

Date: 2026-04-03

- Extended the batch workspace export controls to match the single-job preset flow, with explicit full AV, audio-only, and metadata-only choices plus a preset-aware archive preview.
- Moved the shared preset labels and file-name helpers into a frontend utility so the single-workspace and batch export UIs describe the same archive shapes.
- Updated the batch export API payload and backend archive builder so combined exports now honor the selected preset, including metadata-only exports that no longer require local source video files.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the frontend build and Playwright checks could run. The backend verification also required refreshing the editable install with `python3.11 -m pip install -e backend`.

### Checks run

```bash
npm ci
python3.11 -m pip install -e backend
npm run build:web
python3.11 -m pytest backend/tests/test_package_export.py -k 'batch_package_export'
npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"
```

### Result

- frontend production build passed
- `3 / 3` targeted backend batch package-export tests passed
- `1 / 1` targeted Playwright batch export tests passed

Date: 2026-04-02

## Batch Ready Source Jump Controls Pass

Date: 2026-04-03

- Extended the batch ready-source navigation helper with first and last ready-job targets so the selected-source panel can jump to either end of the current reviewable queue.
- Added explicit `First source` and `Last source` controls beside the existing previous and next buttons, while keeping the selected-source `job` URL param synchronized as reviewers jump across the queue.
- Expanded the targeted Playwright batch-navigation scenario to cover the new jump controls and their disabled states at the queue boundaries.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted verification commands could run.

### Checks run

```bash
npm ci
npm run test:web -- --run src/lib/batch-focus.test.ts
npm run test:e2e -- --grep "batch workspace navigates ready sources from the selected panel"
```

### Result

- `9 / 9` targeted web unit tests passed
- `1 / 1` targeted Playwright batch-navigation tests passed

## Batch Ready Source Shortcut Pass

Date: 2026-04-03

- Added a keyboard shortcut helper for the batch selected-source panel so `[` steps to the previous ready workspace and `]` steps to the next one.
- Scoped the shortcut listener to non-text-entry targets, which keeps the batch quality slider and any future form controls from hijacking the same keystrokes.
- Surfaced the shortcut hint directly in the ready-source navigation card and extended the existing Playwright navigation scenario to prove the keyboard path updates both the selected heading and the `job` URL param.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted verification commands could run.

### Checks run

```bash
npm ci
npm run test:web -- --run src/lib/batch-focus.test.ts
npm run test:e2e -- --grep="batch workspace navigates ready sources from the selected panel"
```

### Result

- `9 / 9` targeted web unit tests passed
- `1 / 1` targeted Playwright batch-navigation tests passed

## Batch Ready Source Navigation Pass

Date: 2026-04-03

- Added a ready-job navigation helper that derives previous and next targets from the current visible batch queue while skipping failed, cancelled, and still-processing sources.
- Added previous and next controls directly in the selected-source panel so reviewers can step through ready uploads without returning to the queue list, while keeping the batch `job` query param synchronized.
- Added focused unit coverage for ready-job adjacency plus Playwright coverage that skips a failed queue item, walks forward and backward through ready jobs, and verifies the selected-source URL updates each time.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted verification commands could run.

### Checks run

```bash
npm ci
npm run test:web -- --run src/lib/batch-focus.test.ts
npm run test:e2e -- --grep='batch workspace persists the selected source in the URL|batch workspace navigates ready sources from the selected panel'
```

### Result

- `8 / 8` targeted web unit tests passed
- `2 / 2` targeted Playwright batch-navigation tests passed

## Batch Selected Source URL Pass

Date: 2026-04-03

- Added a normalized `job` query param for batch workspace URLs so the selected source stays shareable and survives refreshes.
- Updated the batch page loader to read the selected job from search params and seed the client workspace with that source when it is still valid.
- Synced the batch workspace URL whenever triage scope or selected source changes, while still falling back cleanly when the requested job is missing.
- Extended the focused batch URL unit coverage and added Playwright coverage that selects a different source, rewrites the URL, and confirms the same source reopens after reload.
- This checkout again started without frontend dependencies installed, so `npm ci` was required before the targeted verification commands could run.

### Checks run

```bash
npm ci
npm run test:web -- --run src/lib/batch-focus.test.ts
npm run test:e2e -- --grep='saved batch workspaces reopen with failed sources surfaced first|saved batch triage can switch back from issue-only queue to all sources|batch workspace persists the selected source in the URL'
```

### Result

- `7 / 7` targeted web unit tests passed
- `3 / 3` targeted Playwright batch-workspace tests passed

## Saved Batch Triage URL Scope Pass

Date: 2026-04-03

- Centralized the saved-batch workspace URL rules so the landing shortcut, batch page, and workspace toggle all agree on the same triage query shape.
- Preserved the expanded triage view as `scope=all`, while keeping `focus=issues` as the backward-compatible default for issue-only reopens.
- Updated the `Only issues` and `All sources` controls to rewrite the URL in place so refreshes and shared links restore the exact triage scope without resetting the current workspace state.
- Added focused unit coverage for triage query parsing and href generation, plus Playwright coverage for reloading the all-sources triage view and switching back to issue-only mode.
- This checkout started without frontend dependencies installed, so `npm ci` was required before the targeted verification commands could run.

### Checks run

```bash
npm ci
npm run test:web -- --run src/lib/batch-focus.test.ts
npm run test:e2e -- --grep='saved batch workspaces reopen with failed sources surfaced first|saved batch triage can switch back from issue-only queue to all sources'
```

### Result

- `6 / 6` targeted web unit tests passed
- `2 / 2` targeted Playwright saved-batch triage tests passed

## Saved Batch Issue-Only Triage Pass

Date: 2026-04-03

- Updated the saved-batch `focus=issues` flow so reopened sessions now start in an issue-only queue instead of merely pinning failed and cancelled items above ready jobs.
- Added explicit `Only issues` and `All sources` controls in the batch workspace banner so users can stay in retry triage mode or return to the full queue without leaving the page.
- Kept the selected-source panel coherent during issue-only triage by swapping to a focused retry state when the visible issue items do not yet have a workspace to inspect.
- Added unit coverage for issue-only filtering plus targeted Playwright coverage for both the default issue-only reopen and switching back to the full queue.

### Checks run

```bash
npm run test:web -- --run src/lib/batch-focus.test.ts
npm run test:e2e -- --grep='saved batch workspaces reopen with failed sources surfaced first|saved batch triage can switch back from issue-only queue to all sources'
```

### Result

- `4 / 4` targeted web unit tests passed
- `2 / 2` targeted Playwright saved-batch triage tests passed

## Saved Batch Issue-First Reopen Pass

Date: 2026-04-03

- Updated the saved landing-page batch shortcut so sessions with failed or cancelled sources reopen with `focus=issues` and jump directly to the batch queue.
- Added an issue-priority ordering helper so failed and cancelled sources pin to the top of the reopened queue without rewriting the persisted batch-session record.
- Added an attention-first banner in the batch workspace and preserved the original queue ordinals while the issue-focused ordering is active.
- Added unit coverage for the issue-priority ordering helper plus Playwright coverage for reopening a saved batch session into the failure-first queue state.

### Checks run

```bash
npm run test:web
npm run test:e2e -- --grep "saved batch workspaces reopen with failed sources surfaced first|landing page previews failed source names in a saved batch shortcut|landing page reopens the most recent finished batch session"
```

### Result

- `25 / 25` web unit tests passed
- `3 / 3` targeted Playwright saved-batch tests passed

## Saved Batch Failure Preview Pass

Date: 2026-04-03

- Surfaced failed or cancelled source names directly in the landing-page saved batch shortcut so users can judge whether reopening the batch is worthwhile.
- Derived the shortcut names from persisted batch-session items, which keeps older saved sessions compatible without changing the stored summary shape.
- Added targeted Playwright coverage for a saved batch session that includes both failed and cancelled uploads.

### Checks run

```bash
npm run test:web
npm run test:e2e -- --grep "landing page reopens the most recent finished batch session|landing page can dismiss a saved batch shortcut without letting it reappear|landing page previews failed source names in a saved batch shortcut"
```

### Result

- `22 / 22` web unit tests passed
- `3 / 3` targeted Playwright landing-page batch-session tests passed

## Saved Batch Shortcut Dismissal Pass

Date: 2026-04-03

- Fixed the landing-page saved batch shortcut so dismissing it removes the persisted batch session from local storage instead of only hiding the card until the next reload.
- Kept the just-finished queue summary behavior intact so active work still offers `Queue more sources` without implicitly deleting the newest session.
- Added Playwright coverage for dismissing a saved batch shortcut and checking that the stored batch-session record is cleared.

### Checks run

```bash
npm run test:web
npm run lint:web
npm run test:e2e -- --grep "landing page reopens the most recent finished batch session|landing page can dismiss a saved batch shortcut without letting it reappear"
```

### Result

- `21 / 21` web unit tests passed
- frontend lint passed
- `2 / 2` targeted Playwright landing-page batch-session tests passed

## Plan And Queue Status Pass

- Added `PLAN.md` as the living implementation plan for the repository.
- `PLAN.md` now tracks:
  - current goals
  - implemented features and tested status
  - bugs found
  - testing gaps
  - milestone phases
  - categorized frontend, backend, testing, and docs tasks
  - the operating rule to add at least one task every time the plan is opened
- Linked the active plan from `README.md`.
- Completed the first task taken directly from the plan:
  - improved the live batch queue status area on the landing upload surface
- The landing upload progress panel now shows:
  - current source position in the queue
  - current source name and phase
  - backend-ready count
  - waiting count
  - failed / cancelled count
  - clearer per-file status badges inside the queue list
- Added browser coverage for the new queue-status behavior in Playwright.

### Checks run

```bash
npm_config_cache=/tmp/clipmine-npm-cache npm run test:web
npm_config_cache=/tmp/clipmine-npm-cache npm run lint:web
npm_config_cache=/tmp/clipmine-npm-cache npm run build:web
npm run test:e2e
```

### Result

- `19 / 19` web unit tests passed
- frontend lint passed
- frontend production build passed
- `10 / 10` Playwright browser smoke tests passed

## Playwright Recovery Pass

- Re-ran the local Playwright suite after terminal and system access were enabled.
- Confirmed the original Chromium launch blocker is gone on this machine.
- Fixed the remaining failures in the browser smoke suite by:
  - updating multipart upload mocks to use same-origin mock part URLs so XHR `ETag` handling behaves deterministically
  - tightening ambiguous text assertions to role-based or exact-match selectors
  - aligning the queue-upload smoke test with the current multipart intake flow instead of the legacy direct-upload route
- Updated the runner configuration to suppress noisy `NO_COLOR` / `FORCE_COLOR` warnings during local Playwright runs.

### Playwright checks run

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npm run test:e2e
```

### Result

- `9 / 9` browser smoke tests now pass locally.

## Review Workflow And Training Package Pass

- Fixed the React duplicate-key warning in the landing preview by replacing value-derived keys with stable composite/index keys.
- Removed redundant workspace navigation so the sticky top nav is now the single primary workspace control.
- Added batch clip selection, including:
  - per-row selection
  - selected clip panel toggle
  - select visible
  - select shortlist-ready
  - select all shortlisted
  - clear selection
- Added local-storage persistence for selected clip IDs per job.
- Reworked the export tab into a package builder instead of a schema-first screen.
- Added a backend package export endpoint:
  - `POST /api/jobs/{jobId}/exports/package`
- Package export now builds a single zip archive with:
  - `clipmine-export-<jobId>/manifest.json`
  - `clipmine-export-<jobId>/clips/clip_<ordinal>__<clipId>.mp4`
- `manifest.json` now links clip IDs, file names, relative paths, timings, scores, penalties, and word alignments back to each exported clip file.
- Updated the timeline UI so the chart reads like a real analysis instrument instead of a row of small pills, and selected clips are now reflected in the strongest-region view.

## Bugs Fixed In This Pass

### 1. Duplicate React keys in landing preview

- Fixed duplicate `key` warnings in the landing-page preview panel caused by repeated value-derived keys in preview rows and heatmap bars.

### 2. Workspace navigation duplication

- Removed the duplicated inner workspace tabs/buttons that repeated the same controls already present in the sticky top nav.

### 3. Export flow did not match user workflow

- Replaced the old schema-preview-first export surface with a package-first workflow centered on selected clips and training-prep output.

### 4. No way to batch curate clips for export

- Added a dedicated export-selection model separate from the shortlist so users can review clips and build an export package intentionally.

## Scope

This log records the debugging pass completed for the current ClipMine AI repository before pushing the latest updates.

## Additional Runtime Logging Pass

- Added verbose backend runtime logs for:
  - request start and completion
  - upload validation and chunk progress
  - job enqueue and dequeue
  - extraction, transcription, segmentation, and scoring stage transitions
  - export and video retrieval
- Added frontend browser console logs for upload start, progress, completion, and failure states.
- Added `LOG_LEVEL` as a documented backend environment variable.

## Real-File Verification

- Verified upload and processing with `/Users/easton/Desktop/videoplayback.mp4`
- File size: approximately `19 MB`
- Result:
  - upload accepted
  - progress logs emitted during transfer
  - processing reached `ready`
  - transcription completed successfully
  - clip ranking and timeline generation completed successfully
- Verified local browser-origin support for both:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`

## Bugs Fixed

### 1. Upload MIME validation conflict

- Fixed a backend/frontend mismatch where the frontend allowed valid `.mp4` and `.mov` uploads by extension, but the backend could reject the same file if the browser sent an empty or generic MIME type such as `application/octet-stream`.
- The backend now validates the file extension first, accepts known fallback upload MIME types, and stores a canonical video content type based on the extension.

### 2. Orphaned job directories on failed uploads

- Fixed a cleanup issue where oversized uploads could leave behind reserved job folders without a valid manifest.
- The upload path now removes the reserved job directory when the request fails before the manifest is created.

### 3. Incomplete jobs stranded after restart

- Fixed a processor lifecycle issue where queued or in-progress jobs could remain stuck after an app restart.
- The processor now scans the job store on startup, resets incomplete jobs to `queued`, clears stale errors, and re-enqueues them for processing.

### 4. Deprecated 413 status constant

- Replaced a deprecated FastAPI/Starlette status constant with the current `413 content too large` status code constant so the test suite runs cleanly without warnings.

### 5. Missing backend dependency declaration

- Added the `av` dependency to backend project metadata so media probing is installed reliably in fresh environments instead of depending on a pre-existing local package.

### 6. Local browser upload origin mismatch

- Fixed the default backend CORS configuration so local uploads work from both `localhost:3000` and `127.0.0.1:3000`.
- This resolves the common case where the backend was healthy and direct uploads worked in `curl`, but the browser still showed `Upload failed` because the origin was blocked.

### 7. Loopback API host fallback in the frontend

- Fixed the frontend API client so local development no longer assumes a single hardcoded loopback hostname.
- When no explicit `NEXT_PUBLIC_API_BASE_URL` is set, the frontend now prefers the current browser hostname and falls back to the alternate local loopback API host automatically for:
  - upload requests
  - job polling requests

## Features Tested

### Backend API and job lifecycle

- Health endpoint returns the expected service status
- Valid video upload creates a queued job manifest
- Valid `.mov` uploads with generic MIME types are accepted
- Invalid file types are rejected
- Oversized uploads return `413` and do not leave orphan job directories
- Export is blocked until processing completes
- Pending jobs are recovered and re-enqueued on processor startup

### Processing and scoring logic

- Segmentation splits clips correctly on punctuation and timing gaps
- Scoring ranks stronger clips above weaker clips
- Serialized job and export payloads preserve the expected contract shape

### Frontend verification

- Frontend lint passes
- Production build succeeds
- App routes compile successfully for `/` and `/jobs/[jobId]`

## Automated Checks Run

```bash
npm run test:api
npm_config_cache=/tmp/clipmine-npm-cache npm run lint:web
npm_config_cache=/tmp/clipmine-npm-cache npm run build:web
```

## New or Expanded Tests

- `backend/tests/test_jobs_api.py`
  - valid upload happy path
  - generic MIME acceptance for valid video extensions
  - oversized upload cleanup behavior
  - export conflict while processing
- `backend/tests/test_processor.py`
  - restart recovery and requeue behavior for incomplete jobs
- `backend/tests/test_cors.py`
  - localhost browser origin is allowed
  - 127.0.0.1 browser origin is allowed
- Existing test coverage retained for:
  - API serialization shapes
  - scoring behavior
  - segmentation behavior
  - health endpoint behavior

## Multimodal Schema And UI Pass

- Extended clip export data with:
  - `audio_features`
  - `linguistic_features`
  - `word_alignments`
  - `visual_features`
  - `quality_breakdown`
  - `quality_reasoning`
  - `tags`
  - `recommended_use`
  - `embedding_vector`
- Preserved all existing clip fields and ranking behavior while adding the new multimodal structure.
- Updated the workspace UI to surface:
  - quality breakdown bars
  - tags
  - recommended use badges
  - quality reasoning
  - alignment preview
- Updated the timeline to label regions by quality color so stronger and weaker bins are easier to read at a glance.

## Multimodal Bugs Fixed

### 8. Export schema too shallow for multimodal review

- Extended the backend clip schema and export serialization so downstream tooling now receives structured multimodal signals instead of only one summary score and explanation string.

### 9. Timeline regions were not visually labeled by quality

- Updated the frontend timeline chart so bars use quality-based color treatment and a visible legend for `Excellent`, `Good`, and `Weak`.

### 10. Clip detail view hid the new signals

- Refactored the selected clip workspace panel to show the most important new signals directly in the app instead of limiting them to the JSON export.

## Multimodal Features Tested

- Backend enrichment generates consistent nested structures for:
  - audio features
  - linguistic features
  - visual features
  - quality breakdown and reasoning
  - tags and recommended use
  - alignment timestamps
  - embedding vector
- Export payload includes the new multimodal clip fields without dropping legacy fields.
- Real-file processing with `/Users/easton/Desktop/videoplayback.mp4` reached `ready` with:
  - `50` clips
  - `48` timeline bins
  - enriched clip fields present in both `/api/jobs/{jobId}` and `/api/jobs/{jobId}/export.json`
- Frontend routes remained healthy after the UI changes:
  - `/`
  - `/jobs/demo-job`

## Additional Checks Run

```bash
TMPDIR='/Users/easton/Codex Creator Challenge/.tmp-pytest' npm run test:api
npm_config_cache=/tmp/clipmine-npm-cache npm run lint:web
npm_config_cache=/tmp/clipmine-npm-cache npm run build:web
curl -sSf http://127.0.0.1:8000/api/health
curl -I -sSf http://127.0.0.1:3000/
curl -I -sSf http://127.0.0.1:3000/jobs/demo-job
```

## Review Workflow And Test Harness Pass

- Added workspace review controls and shareable URL state:
  - `tab`
  - `clip`
  - transcript search
  - quality filter
  - tag filter
  - sort order
  - pinned-only mode
- Added local-storage backed:
  - recent jobs on the landing page
  - shortlist persistence per job
- Added upload cancel / retry controls and clearer transfer state messaging.
- Extended backend-facing frontend types to include:
  - `processingTimings`
  - `warnings`
  - `processingStats`

## Review Workflow Features Tested

- Frontend unit tests cover:
  - tab parsing defaults
  - filter parsing and serialization
  - clip filtering and sort behavior
  - recent-job persistence ordering
  - shortlist normalization and cleanup
- Backend regression suite still passes after the additive metadata work.
- Frontend lint and production build still pass after the review workflow refactor.

## Browser Smoke Coverage Status

- Added Playwright smoke coverage for:
  - landing page and recent jobs rendering
  - invalid upload validation

## Reliability And Edge-Case Pass

Date/Time: 2026-04-02 14:11:39 PDT

### Bugs fixed

#### 11. Workspace media/export URLs could still point at the wrong loopback host

- Fixed a frontend client bug where `getJob()` could succeed through the fallback API host, but source-video playback and raw JSON export still used the original preferred host.
- The API client now remembers the last successful API base URL and reuses it for workspace media and export links.

#### 12. Corrupted MP4 uploads failed with raw decoder noise

- Fixed backend processing so unreadable or corrupted video files now fail with a concise user-facing error:
  - `Source video could not be decoded. Try another MP4 or MOV file with a readable audio track.`
- Detailed ffmpeg errors are still preserved in backend logs for debugging.

#### 13. Direct upload path used small server-side chunks

- Increased the direct upload read chunk size from `1 MiB` to `4 MiB` to reduce Python I/O overhead on larger uploads.

#### 14. Package export was wasting CPU by recompressing MP4 files in the zip

- Updated package export so `.mp4` clip files are stored with `ZIP_STORED` instead of `ZIP_DEFLATED`.
- This keeps clip packaging faster because the media files are already compressed.

### Features tested

- Frontend unit tests:
  - API upload helper coverage now includes successful fallback base URL memory
- Backend API tests:
  - exact upload-size limit acceptance
  - multipart init part-count scaling for larger source sizes
- Backend processor tests:
  - corrupted MP4 processing fails cleanly with the expected user-facing error
- Backend package export tests:
  - exported `.mp4` clip files are stored without extra zip recompression
- Browser smoke coverage added in code for:
  - multi-file queue flow from the landing page into `/batches/[batchId]`

### Runtime verification

- Started the backend locally on `http://127.0.0.1:8001`
- Verified `GET /api/health` returns healthy readiness checks
- Uploaded a real corrupted file:
  - `/tmp/clipmine-corrupt.mp4`
  - result: job reached `failed`
  - user-facing error: `Source video could not be decoded. Try another MP4 or MOV file with a readable audio track.`
- Uploaded the real sample source:
  - `/Users/easton/Desktop/videoplayback.mp4`
  - size: `19,824,297` bytes
  - upload accepted in roughly `0.105s` locally
  - processing result:
    - `ready`
    - `50` clips
    - top score `100.0`
    - warning: `Audio signal quality is inconsistent across the strongest clips.`
    - timings:
      - `extracting_audio`: `270.1 ms`
      - `transcribing`: `9700.2 ms`
      - `segmenting`: `1.5 ms`
      - `scoring`: `6603.5 ms`
      - `total`: `16641.7 ms`

### Commands run

```bash
npm_config_cache=/tmp/clipmine-npm-cache npm run test:web
TMPDIR='/Users/easton/Codex Creator Challenge/.tmp-pytest' npm run test:api
npm_config_cache=/tmp/clipmine-npm-cache npm run lint:web
npm_config_cache=/tmp/clipmine-npm-cache npm run build:web
curl -s http://127.0.0.1:8001/api/health
curl -s -F "file=@/tmp/clipmine-corrupt.mp4;type=video/mp4" http://127.0.0.1:8001/api/jobs
time curl -s -F "file=@/Users/easton/Desktop/videoplayback.mp4;type=video/mp4" http://127.0.0.1:8001/api/jobs
```

## Reliability-First Upload Pass

- Added backend support for S3-compatible multipart uploads with additive endpoints:
  - `POST /api/uploads/init`
  - `POST /api/uploads/{uploadSessionId}/complete`
  - `DELETE /api/uploads/{uploadSessionId}`
- Added a backend artifact-store abstraction with:
  - `LocalArtifactStore`
  - `S3ArtifactStore`
- Preserved `POST /api/jobs` for local development while enabling `STORAGE_BACKEND=s3` for production source-video storage.
- Added upload-session persistence, expiration cleanup, and best-effort multipart abort cleanup on startup.
- Extended `/api/health` with:
  - `checks.objectStoreReachable`
  - `checks.tempDiskWritable`
  - `activeWorkers`
- Added same-origin S3 video proxy support for `/api/jobs/{jobId}/video` so the frontend playback URL does not change in object-storage mode.
- Standardized backend error payloads around `detail: { code, message, retryable }`.

## Reliability-First Frontend Pass

- Added upload transport selection with:
  - `NEXT_PUBLIC_UPLOAD_MODE=direct`
  - `NEXT_PUBLIC_UPLOAD_MODE=multipart`
- Preserved direct local uploads while adding multipart init → part upload → complete support for production.
- Added explicit upload phases:
  - `validating`
  - `transferring`
  - `finalizing`
  - `processing`
- Added multipart part-upload progress aggregation, typed retryability, and cancel support.
- Updated the upload surface to show phase-aware messaging and only show retry when the failure is retryable.

## Reliability Features Tested

- Backend API tests now cover:
  - multipart upload session initialization
  - multipart upload completion and manifest creation
  - multipart upload abort and session cleanup
  - upload-session expiration cleanup
  - health readiness fields for object storage and temp disk
- Frontend unit tests now cover:
  - upload mode selection
  - multipart progress aggregation
  - backend error-code mapping into user-facing messages
  - retryable error detection

## Reliability Checks Run

```bash
TMPDIR='/Users/easton/Codex Creator Challenge/.tmp-pytest' npm run test:api
npm_config_cache=/tmp/clipmine-npm-cache npm run test:web
npm_config_cache=/tmp/clipmine-npm-cache npm run lint:web
npm_config_cache=/tmp/clipmine-npm-cache npm run build:web
PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npm run test:e2e
```

## Reliability Browser Smoke Status

- The Playwright suite is now configured to run the app in `NEXT_PUBLIC_UPLOAD_MODE=multipart` and mocks:
  - upload session init
  - signed-part uploads
  - upload completion
  - shortlist persistence
  - timeline deep links
  - export pending state
- Local execution on this macOS environment still fails before page code runs because Chromium cannot open a Mach rendezvous port:
  - `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer: Permission denied (1100)`
- This is an environment-level browser-launch restriction, not an application test failure.
- CI is configured to run the same Playwright suite on `ubuntu-latest` with Chromium installed, which is the intended execution environment for the browser smoke tests.
  - upload-to-workspace route transition
  - shareable timeline tab state
  - shortlist persistence across refresh
  - export disabled state while processing
- Attempted to run `npm run test:e2e` locally with:
  - Playwright bundled Chromium
  - system Google Chrome channel
- Result:
  - both browser launch paths fail in this macOS sandbox before any page code runs
  - the failure is environmental, not an application assertion failure

## Latest Checks Run

```bash
npm_config_cache=/tmp/clipmine-npm-cache npm run test:web
TMPDIR='/Users/easton/Codex Creator Challenge/.tmp-pytest' npm run test:api
npm_config_cache=/tmp/clipmine-npm-cache npm run lint:web
npm_config_cache=/tmp/clipmine-npm-cache npm run build:web
PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npm run test:e2e
```

## Precision-First Clip Intelligence Pass

- Tightened segmentation with:
  - filler trimming at clip edges
  - boundary cleanliness checks
  - long-pause and weak-transition splitting
  - low-confidence span rejection
- Added additive per-clip precision metadata:
  - `candidate_metrics`
  - `selection_recommendation`
  - `quality_penalties`
- Extended `quality_breakdown` with:
  - `boundary_cleanliness`
  - `speech_density`
  - `dedupe_confidence`
- Added a precision selection layer that:
  - penalizes messy or filler-heavy spans
  - detects near-duplicate overlap
  - dedupes weaker repeats
  - assigns `shortlist`, `review`, or `discard`
- Updated the workspace UI to show:
  - recommendation badges
  - penalty chips
  - candidate metrics in the selected clip view
  - precision summary counts in export and job summary panels

## Precision Bugs Fixed

### 11. Weak clip edges survived segmentation too often

- The segmenter previously accepted more filler-heavy and weak-boundary spans than it should for a precision-first curation tool.
- Candidate generation now trims obvious filler edges, tracks boundary quality metrics, and rejects clips that remain too messy after trimming.

### 12. Near-duplicate clips crowded the ranking

- The ranking path previously allowed highly overlapping clips with near-identical wording to survive together.
- A new post-score precision pass now measures overlap plus lexical similarity and keeps the stronger clip while tagging duplicate risk on survivors.

### 13. Precision metadata was missing from the workspace

- The backend now exports additive precision fields, and the frontend surfaces them directly in ranked clips, the selected clip panel, the timeline context, and export preview summaries.

## Precision Features Tested

- Backend tests now cover:
  - filler-edge trimming
  - low-confidence candidate rejection
  - near-duplicate dedupe behavior
  - additive export field presence for precision metadata
- Frontend unit tests now cover:
  - recommendation parsing and serialization
  - recommendation and penalty-aware filtering
  - shortlist-ready filtering
- The workspace production build was verified to compile with the new precision UI signals.

## Precision Checks Run

```bash
TMPDIR='/Users/easton/Codex Creator Challenge/.tmp-pytest' npm run test:api
npm_config_cache=/tmp/clipmine-npm-cache npm run test:web
npm_config_cache=/tmp/clipmine-npm-cache npm run lint:web
npm_config_cache=/tmp/clipmine-npm-cache npm run build:web
npm_config_cache=/tmp/clipmine-npm-cache npm run start:web
curl -I http://127.0.0.1:3000/
curl -I 'http://127.0.0.1:3000/jobs/demo-job?tab=timeline'
npm_config_cache=/tmp/clipmine-npm-cache npm run test:e2e
```

## Precision Browser Smoke Status

- Browser smoke specs were extended to assert:
  - recommendation badge visibility
  - penalty chip visibility
  - timeline recommendation language
  - recommendation-based filtering
  - export dedupe/discard summary
- Local Playwright execution still fails in this macOS sandbox before page code runs because Chromium cannot open the required Mach rendezvous port:
  - `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer: Permission denied (1100)`
- This remains an environment-level browser-launch restriction rather than an application assertion failure.

## Queue Completion Summary Pass

- Added a real finished-state summary for batch uploads on the landing page instead of auto-jumping straight into the batch workspace.
- The queue now stops on a clear completion surface that shows:
  - total sources
  - workspace-ready count
  - failed count
  - cancelled count
  - a direct `Open batch workspace` action
- Persisted the latest queue completion summary on the saved batch session record so the batch session carries its intake outcome metadata with it.

## Queue Completion Bugs Fixed

### 14. Batch queues transitioned too abruptly into the workspace

- The landing flow previously redirected immediately after the queue finished, which made it hard to understand whether every source succeeded or whether some failed on the way through intake.
- The upload bay now ends in a completion summary state before navigation so the queue outcome is explicit.

### 15. Batch session records had no completion summary snapshot

- Saved batch sessions previously tracked only item-level records and the threshold value.
- They now optionally persist a completion summary, which gives the landing and batch flows a stable summary object to build on later.

## Queue Completion Features Tested

- Web unit tests cover the updated batch-session persistence shape.
- Browser smoke now covers:
  - batch queue completion summary rendering
  - manual transition from the landing page into the batch workspace after queue completion

## Queue Completion Checks Run

```bash
npm_config_cache=/tmp/clipmine-npm-cache npm run test:web
npm_config_cache=/tmp/clipmine-npm-cache npm run lint:web
npm_config_cache=/tmp/clipmine-npm-cache npm run build:web
npm run test:e2e
```

## Queue Completion Results

- `npm run test:web`: 20 / 20 tests passed
- `npm run lint:web`: passed
- `npm run build:web`: passed
- `npm run test:e2e`: 10 / 10 tests passed

## Playwright Script Environment Pass

- Removed the lingering local browser warning caused by conflicting color environment variables during `npm run test:e2e`.
- The repo-level scripts now unset both `FORCE_COLOR` and `NO_COLOR` for:
  - `npm run test:e2e`
  - `npm run generate:readme-assets`
  - the Playwright preview web-server command

## Playwright Script Bug Fixed

### 16. Browser smoke startup printed a noisy color-env warning

- The browser suite still emitted `The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.` even after the tests were already passing.
- The root cause was the repo script layer: a `FORCE_COLOR` setting in the npm command path could still conflict with inherited shell environment.
- The fix was to unset both env vars explicitly at the repo script boundary so Playwright and its preview server start from a clean color environment.

## Playwright Script Checks Run

```bash
npm run test:e2e
```

## Playwright Script Result

- `npm run test:e2e`: 10 / 10 tests passed
- no `NO_COLOR` / `FORCE_COLOR` startup warning was emitted during the run

## Git Publishing Docs Pass

- Documented the temp-checkout publish workaround in:
  - `README.md`
  - `AGENT.md`
- Recorded the current safe publish sequence:
  - fetch and hard-reset the temp checkout to `origin/main`
  - run `gh auth setup-git` if HTTPS push stalls on the macOS keychain helper
  - publish from the temp checkout instead of the workspace-local `.git`
- Added a note that the README asset workflow can add follow-up commits on `main`, so the temp checkout must be refreshed before each publish.

## Git Publishing Docs Check

```bash
rg -n "temp checkout|gh auth setup-git|fetch origin|README asset workflow" README.md AGENT.md
```

## Saved Batch Shortcut Pass

- Added a landing-page shortcut that reopens the newest saved batch session with a persisted completion summary.
- Kept the existing in-session queue completion card, but made the shared shortcut dismissible for the current visit so `Queue more sources` still clears the bay instead of immediately re-showing the same saved batch.
- Added:
  - a batch-session helper that returns the newest completed saved session
  - a web unit test for that helper
  - a Playwright flow that seeds local storage, surfaces the saved shortcut, and reopens the batch workspace

## Saved Batch Shortcut Checks Run

```bash
npm run test:web
npm run lint:web
npm run build:web
npm run test:e2e -- --grep "landing page reopens the most recent finished batch session|landing page completes a batch queue and then opens the workspace on demand"
```

## Saved Batch Shortcut Results

- `npm run test:web`: 21 / 21 tests passed
- `npm run lint:web`: passed
- `npm run build:web`: passed
- `npm run test:e2e -- --grep "landing page reopens the most recent finished batch session|landing page completes a batch queue and then opens the workspace on demand"`: 2 / 2 tests passed

## Batch Retry Pass

- Added batch-workspace retry controls for failed sources.
- The retry flow now covers two failure modes:
  - upload-stage failures with no `jobId`, by replaying the original source file while it is still available in the active browser tab
  - backend processing failures on an existing `jobId`, by resetting the failed job and re-enqueueing it through a new API endpoint
- Failed-job retries now clear stale derived artifacts and previous transcript/clip output before reprocessing.

## Batch Retry Checks Run

```bash
npm ci
python3.11 -m pip install -e backend
python3.11 -m pip install pytest
npm run test:web
python3.11 -m pytest backend/tests/test_jobs_api.py
npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips|batch workspace retries a failed source without returning home|landing page completes a batch queue and then opens the workspace on demand"
```

## Batch Retry Results

- `npm run test:web`: 22 / 22 tests passed
- `python3.11 -m pytest backend/tests/test_jobs_api.py`: 11 / 11 tests passed
- `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips|batch workspace retries a failed source without returning home|landing page completes a batch queue and then opens the workspace on demand"`: 3 / 3 tests passed

## Batch Retry Environment Notes

- The repo did not have Node dependencies installed at the start of this run, so `npm ci` was required before frontend verification.
- The default `python3` on this machine is 3.13, and that environment segfaulted inside the backend dependency stack before pytest reached the repo tests.
- Backend verification was therefore run with `python3.11`, which completed cleanly against the targeted API test file.

## Shortlist Comparison Pass

- Added shortlist-only compare picks directly in the ranked clip list.
- When two pinned clips are selected for comparison, the workspace now swaps the single-clip detail card for a side-by-side comparison panel.
- The compare panel surfaces transcript, recommendation, metric, tag, and recommended-use differences while keeping clip playback controls available.

## Shortlist Comparison Checks Run

```bash
npm ci
npm run lint:web
npm run test:web
npm run test:e2e -- --grep "shortlisted clips can be compared side by side"
```

## Shortlist Comparison Results

- `npm ci`: completed successfully to install missing workspace dependencies
- `npm run lint:web`: passed
- `npm run test:web`: 29 / 29 tests passed
- `npm run test:e2e -- --grep "shortlisted clips can be compared side by side"`: 1 / 1 test passed

## Export Preset Pass

- Added preset-aware selected-package exports for the single-job workspace.
- The export panel now lets users switch between:
  - the existing full AV package
  - a wav-based audio-only package
  - a metadata-only manifest bundle
- The backend package export route now accepts a `preset` field, builds preset-specific archive names and file layouts, and skips the source-video existence requirement for metadata-only exports.

## Export Preset Checks Run

```bash
python3.11 -m pip install -e backend
npm ci
python3.11 -m pytest backend/tests/test_package_export.py
npm run build:web
npm run test:e2e -- --grep "selected clips can be batched into a package export"
```

## Export Preset Results

- `python3.11 -m pip install -e backend`: completed successfully
- `npm ci`: completed successfully
- `python3.11 -m pytest backend/tests/test_package_export.py`: 6 / 6 tests passed
- `npm run build:web`: passed
- `npm run test:e2e -- --grep "selected clips can be batched into a package export"`: 1 / 1 test passed

## Batch Aggregate Source Summary Pass

- Added a ready-source contribution summary to the batch aggregate export card so each ready upload shows its current eligible clip total before download.
- Included zero-count ready sources in that summary so strict thresholds make excluded uploads explicit instead of silently dropping them from the review context.
- Extended the existing batch export Playwright scenario to assert the per-source totals update as the threshold moves between Strict, Balanced, and Broad.

## Batch Aggregate Source Summary Checks Run

```bash
npm ci
npm run lint:web
env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright test --grep "batch workspace groups jobs and exports thresholded clips"
```

## Batch Aggregate Source Summary Results

- `npm ci`: completed successfully
- `npm run lint:web`: passed
- `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright test --grep "batch workspace groups jobs and exports thresholded clips"`: 1 / 1 test passed

## Batch Aggregate Duration Share Pass

- Added a per-source eligible-duration share badge to the ready-source aggregate export summary so each ready upload shows how much of the current download it contributes.
- Kept the share calculation anchored to the currently displayed ready-source totals so Strict, Balanced, and Broad threshold changes update the percentages in place without drifting from the rendered duration chips.
- Extended the existing batch export Playwright scenario to assert the new percentage badges across equal-share, zero-share, and full-share states.

## Batch Aggregate Duration Share Checks Run

```bash
npm ci
npm run lint:web -- --file src/components/batch/batch-workspace.tsx
npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"
```

## Batch Aggregate Duration Share Results

- `npm ci`: completed successfully to install missing frontend dependencies in this worktree before rerunning the targeted checks
- `npm run lint:web -- --file src/components/batch/batch-workspace.tsx`: passed
- `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`: 1 / 1 test passed

## Ready-Source Queue Badges Pass

- Added ready-source position badges to the batch queue cards so ready items now show their review order directly in the visible queue.
- Surfaced overlapping state badges for first, current, and last ready sources so reviewers can spot navigation anchors without opening each workspace.
- Extended the existing ready-source navigation Playwright scenario to assert the new queue badges render and move with the selected source.

## Ready-Source Queue Badges Checks Run

```bash
npm ci
npm run test:web -- --run src/lib/batch-focus.test.ts
npm run test:e2e -- --grep "batch workspace navigates ready sources from the selected panel"
```

## Ready-Source Queue Badges Results

- `npm ci`: completed successfully
- `npm run test:web -- --run src/lib/batch-focus.test.ts`: 14 / 14 tests passed
- `npm run test:e2e -- --grep "batch workspace navigates ready sources from the selected panel"`: 1 / 1 test passed
