# Verification Log

Date: 2026-04-01

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
- Existing test coverage retained for:
  - API serialization shapes
  - scoring behavior
  - segmentation behavior
  - health endpoint behavior
