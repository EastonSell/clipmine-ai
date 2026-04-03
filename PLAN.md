# ClipMine AI Plan

> Global operating prompt:
> At the start of every automated loop iteration, sync the repo first with `git fetch origin` and `git reset --hard origin/main`, then evaluate `LOCK.md`. If a fresh lock exists, exit immediately without changing files, adding tasks, or committing anything. If no fresh lock exists, create `LOCK.md`, commit and push it, then sync the repo again and verify that the pushed `run_id` still matches before doing any work. Only the run whose verified `run_id` matches may proceed.

## Loop Rules

- Always begin by reading this file (PLAN.md)
- Before checking `LOCK.md`:
  - Run `git fetch origin`
  - Run `git reset --hard origin/main`
- After sync:
  - If `LOCK.md` exists:
    - Read the timestamp inside it
    - If the lock is 30 minutes old or less → exit immediately with no file changes, no task additions, and no commits
    - If the lock is older than 30 minutes:
      - Delete `LOCK.md`
      - `git add LOCK.md`
      - `git commit -m 'agent: clear stale lock'`
      - `git push origin main`
      - Continue to normal lock acquisition
  - If `LOCK.md` does not exist:
    - Create it with:
      - `timestamp: <ISO 8601 UTC>`
      - `run_id: <short identifier>`
    - Immediately:
      - `git add LOCK.md`
      - `git commit -m 'agent: acquire lock <run_id>'`
      - `git push origin main`
      - `git fetch origin`
      - `git reset --hard origin/main`
      - Read `LOCK.md` again
      - If `run_id` does not match the value just created → exit immediately with no changes
- Do not modify `PLAN.md`, add tasks, or perform product work before the lock commit is pushed and the post-push `run_id` verification succeeds
- Select the highest-impact unfinished task
- Complete ONLY 1–2 tasks per run unless the task-regeneration fallback is triggered
- Add EXACTLY 1 new task per run unless the task-regeneration fallback is triggered
- Prefer improving existing systems over adding new ones
- Avoid duplicate, vague, or low-value tasks

## Workflow
1. `git fetch origin`
2. `git reset --hard origin/main`
3. Inspect `LOCK.md`
4. If `LOCK.md` is fresh, exit immediately with no changes and no commits
5. If `LOCK.md` is stale, remove it, commit `agent: clear stale lock`, and push
6. Create `LOCK.md` with a UTC timestamp and a short `run_id`
7. Commit `agent: acquire lock <run_id>` and push to `origin/main`
8. Immediately run `git fetch origin` and `git reset --hard origin/main`
9. Re-read `LOCK.md`
10. If the `run_id` does not match, exit immediately with no changes
11. Only after the verified lock matches:
   - If the task-regeneration fallback is triggered, add EXACTLY 5 new high-level tasks aligned with this plan, then stop
   - Otherwise, add exactly 1 task and select the highest priority unfinished task
12. Implement minimal, clean solution
13. Run tests if applicable
14. Update:
   - PLAN.md (mark completed + add 1 task during a normal run, or add EXACTLY 5 new high-level tasks and stop if the fallback was triggered)
   - VERIFICATION_LOG.md
15. Commit product changes with a clear message
16. Push to main
17. Remove `LOCK.md`
18. `git add LOCK.md`
19. `git commit -m 'agent: release lock <run_id>'`
20. `git push origin main`

## Safety Rules
- Never leave `LOCK.md` behind if execution completes
- If execution fails after lock acquisition, attempt to remove `LOCK.md`, commit `agent: release lock <run_id>`, and push before exit
- Never modify `PLAN.md`, `VERIFICATION_LOG.md`, or source files when exiting due to a fresh lock
- Never perform implementation work before the lock acquisition commit is pushed and verified
- Avoid large refactors unless explicitly required
- Do not break existing workflows (upload, review, export)

## Stop Conditions
- If no meaningful progress can be made → exit cleanly
- If exiting because a fresh lock exists → do nothing except exit
- Do NOT fabricate work
- Do NOT loop indefinitely inside a single run

## Task Regeneration Fallback

- If all existing tasks in this plan are checked off, and no new novel ideas were found for tasks or improvements, and no testing is needed, and no bug fixing is needed, then trigger the fallback.
- When the fallback is triggered, create and add EXACTLY 5 NEW high-level tasks that align with the current project goals, prioritization strategy, and roadmap in this plan.
- Those EXACTLY 5 NEW tasks must be meaningfully distinct, non-duplicate, and broad enough to guide future iterations.
- When the fallback is triggered, creating and adding those EXACTLY 5 NEW high-level tasks is THE ONLY task to do in that run.
- After adding those EXACTLY 5 NEW high-level tasks, stop the run. Do not do any other implementation, testing, bug fixing, refactoring, documentation, or task creation in that same run.

## Lock File Format

Use this exact minimal shape for `LOCK.md`:

```text
timestamp: 2026-04-02T17:45:00Z
run_id: abc123
```

Interpret the timestamp in UTC and treat any lock older than 30 minutes as stale.

## Lock Validation

- Sync the repo before checking the lock
- Push lock acquisition before any work begins
- Immediately fetch/reset after the lock push and verify that `LOCK.md` still contains the same `run_id`
- If the verified `run_id` does not match, exit immediately with no changes
- Push lock release after work completes
- If a fresh lock exists, do not change files, add tasks, or commit
- If a stale lock exists, clear it with a dedicated commit before continuing
- The goal is that only one Codex worktree run can perform work at a time

---

## PRIORITIZATION STRATEGY

When choosing tasks, prefer:

1. User-visible improvements (UX clarity, flow)
2. Data extraction improvements (audio/video features, metadata)
3. Model quality or ranking improvements
4. Reliability and edge-case handling
5. Performance improvements
6. Documentation (only if necessary)

Avoid:
- Cosmetic-only changes
- Redundant refactors
- Low-impact micro-tasks

---

## Working Rules

1. Add at least one new task on every read of this plan, unless the task-regeneration fallback is triggered, in which case add EXACTLY 5 new high-level tasks.
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

- [x] Node printed `NO_COLOR` / `FORCE_COLOR` warnings during Playwright startup even though the suite passed.
  Notes: Fixed on 2026-04-02 by unsetting both env vars at the repo script boundary for Playwright and README asset generation.
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
- [x] Side-by-side shortlist comparison
- [ ] Export preset options beyond JSON + zip

## Frontend Tasks

- [x] Improve live batch queue status
  Prompt: "Rework the landing upload progress area so multi-file queues clearly show the current source, queue position, waiting count, backend-ready count, and failed count while uploads are in flight."
  Notes: Added on 2026-04-02 and completed in the same pass.
  Verified: `npm run test:e2e`, `npm run test:web`, `npm run build:web`

- [x] Add per-job retry from batch workspace
  Prompt: "Let users retry a failed source from the batch workspace instead of forcing them back to the landing page."
  Notes: Completed on 2026-04-03 by adding inline retry controls in the batch workspace for both upload-stage failures and backend processing failures. Failed uploads now reuse the original source file while it remains available in the active browser tab, and failed jobs can be re-queued against the existing backend job record.
  Verified: `npm run test:web`, `python3.11 -m pytest backend/tests/test_jobs_api.py`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips|batch workspace retries a failed source without returning home|landing page completes a batch queue and then opens the workspace on demand"`

- [x] Add side-by-side shortlisted clip comparison
  Prompt: "Build a compact comparison mode for two shortlisted clips so users can inspect transcript, metrics, and recommendation differences without switching context."
  Notes: Completed on 2026-04-03 by adding shortlist-only compare picks in the ranked clip list and swapping the detail panel into a side-by-side comparison view once two pinned clips are chosen. The comparison mode now highlights transcript, recommendation, metric, tag, and recommended-use differences while keeping playback controls in place.
  Verified: `npm run lint:web`, `npm run test:web`, `npm run test:e2e -- --grep "shortlisted clips can be compared side by side"`

- [x] Add export preset selector
  Prompt: "Extend the export panel with presets like full AV package, audio-only package, and metadata-only package while keeping the current zip export as the default."
  Notes: Completed on 2026-04-03 by adding preset cards to the single-job export panel, keeping the existing video package as the default, and wiring audio-only plus metadata-only downloads through the package export API with preset-aware archive previews.
  Verified: `python3.11 -m pip install -e backend`, `npm ci`, `python3.11 -m pytest backend/tests/test_package_export.py`, `npm run build:web`, `npm run test:e2e -- --grep "selected clips can be batched into a package export"`

- [x] Add batch export preset selector
  Prompt: "Let the batch workspace export flow choose between full AV, audio-only, and metadata-only packages so cross-job downloads match the single-workspace export presets."
  Notes: Completed on 2026-04-03 by reusing the preset model from the single-workspace export flow, adding preset cards and preview layout updates in the batch workspace, and wiring preset-aware combined batch exports through the frontend API and backend archive builder.
  Verified: `npm ci`, `python3.11 -m pip install -e backend`, `npm run build:web`, `python3.11 -m pytest backend/tests/test_package_export.py -k 'batch_package_export'`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Persist batch export preset choice per batch session
  Prompt: "Remember the last preset chosen in the batch workspace so refreshes and reopened saved sessions keep the same export mode instead of snapping back to full AV."
  Notes: Completed on 2026-04-03 by storing the selected batch export preset in the saved batch-session record, hydrating the batch workspace from that stored value on load, and keeping the aggregate export preview and download path aligned after refreshes and reopened sessions.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-sessions.test.ts`, `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright test --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Persist batch export preset in the URL
  Prompt: "Keep the batch workspace URL aligned with the active export preset so shared or bookmarked batch links can reopen the same export mode without depending on local browser storage alone."
  Notes: Completed on 2026-04-03 by adding a normalized `preset` query param to the batch workspace URL, honoring that value on the batch route load, and keeping the URL synchronized with preset changes while preserving the existing selected-job state.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright install chromium`, `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright test --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Persist batch quality threshold in the URL
  Prompt: "Keep the batch workspace URL aligned with the active quality threshold so shared or bookmarked batch review links can reopen the same score floor without depending on saved browser state."
  Notes: Completed on 2026-04-03 by adding a validated `threshold` query param to the batch workspace URL flow, preferring that value over saved batch-session state on load, and keeping the URL synchronized when the export score slider changes.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Add quality-threshold quick presets in the batch workspace
  Prompt: "Add quick preset buttons like Strict, Balanced, and Broad near the batch export slider so reviewers can jump between common score floors without dragging the range input."
  Notes: Completed on 2026-04-03 by adding shared Strict, Balanced, and Broad threshold presets, wiring one-click buttons beside the aggregate export slider, and keeping those preset jumps aligned with the existing URL and saved-session threshold state.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Show eligible clip counts inside batch threshold presets
  Prompt: "Annotate the Strict, Balanced, and Broad quick preset buttons with the current eligible clip counts so reviewers can see the export tradeoff before switching thresholds."
  Notes: Completed on 2026-04-03 by deriving live eligible-clip totals for each shared threshold preset, surfacing those counts directly inside the Strict, Balanced, and Broad buttons, and extending the existing batch export coverage to prove the annotated counts stay aligned with the seeded clip data.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright test --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Show per-job eligible clip totals in the batch aggregate export summary
  Prompt: "Break the aggregate export selection down by ready source so reviewers can see which uploads contribute clips at the current threshold before downloading."
  Notes: Completed on 2026-04-03 by adding a ready-source contribution summary beneath the aggregate export metrics, surfacing zero-count sources when the current threshold excludes them, and keeping the per-source totals synced with threshold changes before download.
  Verified: `npm ci`, `npm run lint:web`, `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright test --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Add source-jump actions to the aggregate export summary
  Prompt: "Let reviewers open a source directly from the ready-source aggregate export summary so they can inspect why it does or does not contribute clips before downloading."
  Notes: Completed on 2026-04-03 by adding per-source inspect actions to the ready-source export summary, syncing those actions with the selected batch source panel, and highlighting the currently selected source directly inside the aggregate export card.
  Verified: `npm ci`, `npm run lint:web -- --file src/components/batch/batch-workspace.tsx`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Show eligible duration totals in the aggregate export summary
  Prompt: "Add per-source eligible clip duration totals beside the clip counts in the ready-source aggregate export summary so reviewers can compare likely download value before exporting."
  Notes: Completed on 2026-04-03 by deriving eligible-duration totals per ready source from the current thresholded batch clips and surfacing that runtime beside each source's eligible clip-count badge in the aggregate export summary.
  Verified: `npm ci`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Show each ready source's share of eligible duration in the aggregate export summary
  Prompt: "Add a per-source share of total eligible duration to the ready-source aggregate export summary so reviewers can compare how much of the download each source contributes before exporting."
  Notes: Completed on 2026-04-03 by adding a per-source percentage badge beside each ready source's eligible duration, deriving the share from the currently displayed ready-source totals so the percentages stay aligned with threshold changes.
  Verified: `npm ci`, `npm run lint:web -- --file src/components/batch/batch-workspace.tsx`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Add contribution bars to the aggregate export summary
  Prompt: "Render a compact visual contribution bar for each ready source in the aggregate export summary so reviewers can scan dominant download contributors faster than reading percentages alone."
  Notes: Completed on 2026-04-03 by replacing the text-only eligible-duration share badge with a labeled contribution meter for each ready source while keeping the displayed percentage and bar width derived from the same thresholded duration totals.
  Verified: `npm ci`, `npm run lint:web -- --file src/components/batch/batch-workspace.tsx --file src/components/ui/progress-bar.tsx`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Sort ready sources by current export contribution in the aggregate summary
  Prompt: "Order the ready-source aggregate export rows by the current eligible contribution so reviewers see the biggest download drivers first without scanning the whole list."
  Notes: Completed on 2026-04-03 by sorting ready-source aggregate export rows by eligible duration first, then eligible clip count, while keeping the original ready-source order as the stable fallback when contributions tie.
  Verified: `npm ci`, `npm run lint:web -- --file src/components/batch/batch-workspace.tsx`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Add contribution rank badges to the aggregate export summary
  Prompt: "Show each ready source's current contribution rank directly in the aggregate export summary so reviewers can spot the top download drivers before reading the duration details."
  Notes: Completed on 2026-04-03 by adding ordinal contribution-rank badges to each ready-source summary row and keeping those labels derived from the existing eligible-duration, eligible-clip-count, and ready-source tie-break ordering so threshold changes update the rank in place.
  Verified: `npm ci`, `npm run lint:web -- --file src/components/batch/batch-workspace.tsx`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Add a contributors-only toggle to the aggregate export summary
  Prompt: "Let reviewers temporarily hide ready sources that contribute zero clips at the current threshold so large batch exports stay focused on the sources that will actually ship."
  Notes: Completed on 2026-04-03 by adding a temporary contributors-only toggle to the batch aggregate export summary, hiding zero-clip ready sources from the summary rows while the toggle is active, and surfacing explanatory copy when below-threshold sources are being filtered out.
  Verified: `npm ci`, `npm run lint:web -- --file src/components/batch/batch-workspace.tsx`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Add a broader-threshold recovery action when the aggregate export summary is empty
  Prompt: "When the current batch threshold leaves no contributing ready sources, offer a one-click way to jump to the next broader preset so reviewers can recover from an empty export summary without dragging the slider."
  Notes: Completed on 2026-04-03 by collapsing the ready-source aggregate summary into an empty recovery state when no ready sources contribute at the current threshold, surfacing a one-click jump to the next broader preset, and previewing how many eligible clips that broader preset will reopen before the reviewer clicks.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Preview which ready sources return after a broader-threshold recovery jump
  Prompt: "When the empty aggregate export summary suggests a broader preset, preview the ready source names that would contribute again at that suggested threshold so reviewers understand the recovery before clicking."
  Notes: Completed on 2026-04-03 by extending the empty aggregate-summary recovery state to preview the ready source names and eligible clip counts that return at the next broader preset, so reviewers can see which sources will re-enter the export before changing the threshold.
  Verified: `npm_config_cache=/tmp/clipmine-npm-cache npm run lint --workspace apps/web -- src/components/batch/batch-workspace.tsx`, `npm_config_cache=/tmp/clipmine-npm-cache npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Add inspect actions to broader-threshold recovery previews
  Prompt: "When the empty aggregate export summary previews returning ready sources, let reviewers jump straight into those source workspaces before they commit to a broader threshold."
  Notes: Completed on 2026-04-03 by turning the broader-threshold recovery preview chips into inspect actions that reuse the existing batch source jump behavior, keep the current threshold in place, and highlight the currently inspected preview source.
  Verified: `npm ci`, `npm run lint:web -- --file src/components/batch/batch-workspace.tsx`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [x] Show projected eligible duration in broader-threshold recovery previews
  Prompt: "When the empty aggregate export summary previews returning ready sources, include how much eligible duration each source would add at the suggested threshold so reviewers can compare likely export value before inspecting or broadening."
  Notes: Completed on 2026-04-03 by extending the broader-threshold recovery preview chips with per-source eligible duration at the suggested preset and using that same projected duration to break ties when preview sources have matching clip counts.
  Verified: `npm ci`, `cd apps/web && npx eslint src/components/batch/batch-workspace.tsx --max-warnings=0`, `npm run test:e2e -- --grep "batch workspace groups jobs and exports thresholded clips"`

- [ ] Show total projected eligible duration in the broader-threshold recovery summary
  Prompt: "When the empty aggregate export summary suggests a broader preset, show the total eligible duration that threshold would restore so reviewers can compare the full export gain before clicking."

- [x] Add queue completion toast and summary state
  Prompt: "When a batch queue finishes, show a stronger completion summary before navigating so the user understands how many sources succeeded or failed."
  Notes: Added on 2026-04-02 and completed in the same pass. The landing page now stops on a finished-state summary with success / failure counts and a direct button into the batch workspace.
  Verified: `npm run test:web`, `npm run lint:web`, `npm run build:web`, `npm run test:e2e`

- [x] Surface the latest finished batch session from the landing page
  Prompt: "Add a compact landing shortcut for the most recently completed batch session so users can reopen it without re-queueing the same sources."
  Notes: Completed on 2026-04-02 by loading the newest completed batch session from local storage and surfacing a persistent reopen card in the landing upload bay when no queue is active.
  Verified: `npm run test:web`, `npm run lint:web`, `npm run build:web`

- [x] Add dismiss action for stale finished batch shortcuts
  Prompt: "Let users clear an outdated finished batch session shortcut from the landing page so local-session clutter does not keep resurfacing old work."
  Notes: Completed on 2026-04-03 by differentiating the saved landing shortcut from the just-finished queue summary. Saved shortcuts now remove their persisted batch session from local storage, while current queue completions keep the existing queue-more flow.
  Verified: `npm run test:web`, `npm run lint:web`, `npm run test:e2e -- --grep "landing page reopens the most recent finished batch session|landing page can dismiss a saved batch shortcut without letting it reappear"`

- [x] Preview failed source names in the saved batch shortcut
  Prompt: "If the latest finished batch session includes failed or cancelled uploads, list the affected source names directly in the landing shortcut so users can decide whether reopening the batch is worthwhile."
  Notes: Completed on 2026-04-03 by deriving failed and cancelled source names from the persisted batch session items and surfacing them directly in the landing shortcut for saved and just-finished batch summaries.
  Verified: `npm run test:web`, `npm run test:e2e -- --grep "landing page reopens the most recent finished batch session|landing page can dismiss a saved batch shortcut without letting it reappear|landing page previews failed source names in a saved batch shortcut"`

- [x] Open saved batch workspaces with failed sources surfaced first
  Prompt: "When reopening a saved batch session that includes failed or cancelled uploads, land the user on the jobs that need attention first instead of making them hunt through the batch list."
  Notes: Completed on 2026-04-03 by reopening saved batch shortcuts with a `focus=issues` state, jumping directly to the queue section, pinning failed and cancelled sources above ready jobs, and preserving original queue ordinals while the issue-first view is active.
  Verified: `npm run test:web`, `npm run test:e2e -- --grep "saved batch workspaces reopen with failed sources surfaced first|landing page previews failed source names in a saved batch shortcut|landing page reopens the most recent finished batch session"`

- [x] Add issue-only toggle for saved batch triage
  Prompt: "Let users collapse the reopened batch queue to only failed or cancelled sources so retry triage stays focused before they return to ready jobs."
  Notes: Completed on 2026-04-03 by defaulting saved `focus=issues` reopens into an issue-only queue, adding explicit `Only issues` and `All sources` controls, and keeping the selected-source panel useful when no visible issue has a workspace yet.
  Verified: `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep='saved batch workspaces reopen with failed sources surfaced first|saved batch triage can switch back from issue-only queue to all sources'`

- [x] Persist saved-batch triage scope in the URL
  Prompt: "Keep the saved batch workspace URL in sync with the issue-only vs all-sources toggle so refreshes and shared links preserve the exact triage scope."
  Notes: Completed on 2026-04-03 by centralizing saved-batch triage URL parsing/building, preserving the full-queue triage state with `scope=all`, and updating the workspace toggle in place so refreshes keep the same scope without resetting the current batch session.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep='saved batch workspaces reopen with failed sources surfaced first|saved batch triage can switch back from issue-only queue to all sources'`

- [x] Persist selected batch source in the URL
  Prompt: "Keep the batch workspace URL aligned with the currently selected source so refreshes and shared links reopen the same source detail panel instead of defaulting back to the first available job."
  Notes: Completed on 2026-04-03 by adding a `job` query param to the batch workspace URL, honoring that param on the batch page load, and rewriting the URL whenever the selected source changes or falls back to the first valid job.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep='saved batch workspaces reopen with failed sources surfaced first|saved batch triage can switch back from issue-only queue to all sources|batch workspace persists the selected source in the URL'`

- [x] Add per-source ETA hints to the active queue card
  Prompt: "Estimate queue progress for the current source and remaining queue so large multi-file uploads feel less opaque while the active transfer is running."
  Notes: Completed on 2026-04-03 by adding upload-intake ETA estimation for the active source and remaining queue, warming the estimate from live progress when bytes are in flight and falling back to completed-source timings when the next source is only validating.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-upload-eta.test.ts`, `cd apps/web && npx eslint src/components/landing/upload-section.tsx src/lib/batch-upload-eta.ts src/lib/batch-upload-eta.test.ts --max-warnings=0`

- [x] Add transfer-basis labels to batch ETA hints
  Prompt: "Show whether each queue ETA is coming from live throughput or previously completed uploads so reviewers know how much confidence to put in the estimate."
  Notes: Completed on 2026-04-03 by extending the batch ETA helper to return per-card estimate basis metadata, surfacing live-vs-history labels in the landing queue timing hints, and calling out the mixed case where the active source uses live transfer data while later queued sources still rely on completed-upload history.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-upload-eta.test.ts`, `cd apps/web && npx eslint src/components/landing/upload-section.tsx src/lib/batch-upload-eta.ts src/lib/batch-upload-eta.test.ts --max-warnings=0`, `npm run build:web`

- [x] Show completed-source sample counts beside history-based batch ETA hints
  Prompt: "When a batch ETA falls back to completed-upload history, show how many completed sources contributed to that estimate so reviewers can judge whether the timing signal is still thin or stable."
  Notes: Completed on 2026-04-03 by extending the batch ETA estimate model with completed-history sample counts, appending those counts to the history and mixed ETA basis labels, and wiring the landing queue card to show that context only when completed uploads contribute to the estimate.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-upload-eta.test.ts`, `cd apps/web && npx eslint src/lib/batch-upload-eta.ts src/lib/batch-upload-eta.test.ts src/components/landing/upload-section.tsx --max-warnings=0`

- [ ] Flag low-confidence batch ETA history when only one completed source is available
  Prompt: "When a history-based queue ETA is still based on a single completed source, add a low-confidence indicator so reviewers know the estimate may swing sharply as more uploads finish."

- [x] Preserve failed-upload retry readiness across reloads
  Prompt: "Persist enough local source reference data that a failed upload in the batch workspace can still be retried after a refresh or reopened saved batch, instead of only within the original tab lifetime."
  Notes: Completed on 2026-04-03 by persisting queued batch source files into an IndexedDB-backed browser cache with an in-memory fallback, hydrating saved-batch retry availability from that cache on workspace load, and reusing the persisted source on retry after a full page reload.
  Verified: `npm ci`, `npm run build:web`, `npm run test:e2e -- --grep "saved batch workspace retries a failed source after reload"`

- [x] Warn when browser source persistence is unavailable for failed batch retries
  Prompt: "Surface when the browser cannot keep retry source data across reloads so reviewers know a failed source may need to be re-queued from home."
  Notes: Completed on 2026-04-03 by detecting when the batch source-file cache falls back to tab-only memory, surfacing a queue-level warning for affected failed uploads, and adding per-item copy so reviewers know they must retry in the current tab or re-queue from home after a refresh.
  Verified: `npm ci`, `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_BROWSERS_PATH=/tmp/clipmine-playwright-browsers npx playwright test --grep "saved batch workspace retries a failed source after reload|batch workspace warns when retry source persistence is unavailable"`

- [x] Add previous and next source navigation in the batch workspace
  Prompt: "Let reviewers move between ready sources from the selected-source panel so comparing adjacent uploads does not require jumping back to the queue list each time."
  Notes: Completed on 2026-04-03 by deriving previous and next ready-job targets from the visible batch queue, adding inline navigation controls in the selected-source panel, and keeping the batch `job` query param in sync while reviewers step between ready uploads.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep='batch workspace persists the selected source in the URL|batch workspace navigates ready sources from the selected panel'`

- [x] Add keyboard shortcuts for ready-source navigation in the batch workspace
  Prompt: "Let reviewers move between ready sources with keyboard shortcuts from the batch workspace so adjacent comparisons stay fast without repeated clicks."
  Notes: Completed on 2026-04-03 by adding `[` and `]` ready-source shortcuts in the selected-source panel, ignoring text-entry targets like the threshold slider, and surfacing the shortcut hint directly in the navigation card.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep="batch workspace navigates ready sources from the selected panel"`

- [x] Add first and last ready-source jump controls in the batch workspace
  Prompt: "Let reviewers jump straight to the first or last ready source from the selected-source panel so large queues do not require repeated next or previous steps."
  Notes: Completed on 2026-04-03 by extending the ready-source navigation model with first and last targets, adding direct jump controls alongside the existing previous and next actions, and updating the selected-panel copy so the jump behavior is explicit while the `job` URL param stays in sync.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep "batch workspace navigates ready sources from the selected panel"`

- [x] Add ready-source position badges to batch queue cards
  Prompt: "Show each ready source's review-order position directly in the batch queue so reviewers can spot the first, current, and last ready workspaces before opening one."
  Notes: Completed on 2026-04-03 by deriving ready-source positions from the visible batch queue order, surfacing queue-card badges for ready position plus first/current/last state, and extending the existing ready-source navigation coverage to assert those badges update with selection changes.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep "batch workspace navigates ready sources from the selected panel"`

- [x] Add a ready-only filter to the batch queue
  Prompt: "Let reviewers collapse the batch queue to only ready workspaces so large saved sessions can focus on clip review without scanning failed or still-processing sources."
  Notes: Completed on 2026-04-03 by extending the batch queue visibility helper with a ready-only mode, adding a dedicated queue-focus toggle to the workspace, and preserving the selected ready job while hidden failed and processing sources drop out of the visible queue.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep "batch workspace can collapse the queue to ready sources only"`

- [x] Persist ready-only batch queue scope in the URL
  Prompt: "Keep the ready-only queue focus in the batch workspace URL so reopened saved sessions can return directly to review mode instead of expanding back to the full queue."
  Notes: Completed on 2026-04-03 by adding a dedicated `queue=ready` search param to the batch workspace URL helpers, hydrating the ready-only toggle from the App Router page on load, and preserving that queue focus through reloads without dropping the selected ready job.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep "batch workspace can collapse the queue to ready sources only"`

- [x] Add ready-review reopen action to saved batch shortcuts
  Prompt: "When a saved batch session already has ready workspaces, let the landing shortcut reopen it directly in ready-only mode so reviewers can skip the full queue and resume clip review immediately."
  Notes: Completed on 2026-04-03 by adding a saved-session `Resume ready review` action on the landing shortcut, routing that CTA through the existing ready-only batch URL state, and seeding the reopened batch workspace with the first ready job so reviewers land directly in clip review without losing the existing full-workspace or issue-triage reopen path.
  Verified: `npm ci`, `npm run test:web -- --run src/lib/batch-focus.test.ts`, `npm run test:e2e -- --grep "landing page reopens the most recent finished batch session|saved batch shortcuts can resume ready review directly"`

## Backend Tasks

- [ ] Resume multipart uploads across browser refresh
  Prompt: "Persist active upload sessions strongly enough that the frontend can resume a multipart transfer after a refresh when the session is still valid."

- [x] Add audio-only export companion
  Prompt: "Support an optional audio-only export path that trims `.wav` files alongside the existing mp4 package structure."
  Notes: Completed on 2026-04-03 as part of the export preset pass by adding preset-aware single-job package exports, wav clip trimming, metadata-only manifest bundles, and source-file-optional validation for manifest-only downloads.
  Verified: `python3.11 -m pip install -e backend`, `python3.11 -m pytest backend/tests/test_package_export.py`

- [ ] Add batch export partial-failure manifest warnings
  Prompt: "If some selected jobs fail during combined export, preserve successful jobs in the archive and record the failed jobs in the manifest warnings."

- [ ] Add object-storage playback verification endpoint
  Prompt: "Expose a lightweight diagnostic path or health detail that confirms remote source playback reads are working end to end."

## Testing Tasks

- [x] Remove Playwright color warnings
  Prompt: "Trace the remaining `NO_COLOR` / `FORCE_COLOR` conflict during Playwright startup and eliminate the warnings without breaking the local browser test path."
  Notes: Completed on 2026-04-02 by unsetting both `FORCE_COLOR` and `NO_COLOR` in the repo-level Playwright scripts and preview server command.
  Verified: `npm run test:e2e`

- [ ] Add a smoke assertion for the finished batch summary action row
  Prompt: "Ensure the completed queue state always renders the open-workspace and queue-more actions together so the landing page never strands the user after a finished batch."

- [ ] Add a console-warning guard around the browser smoke runner
  Prompt: "Teach the browser smoke path to fail or flag when known startup warnings reappear so regressions like duplicate keys or color-env conflicts are caught immediately."

- [ ] Add non-mocked browser verification against the local API
  Prompt: "Create a dedicated Playwright job that talks to the real local FastAPI backend for one smoke path instead of mocking every API response."

- [ ] Add regression coverage for batch queue cancellation
  Prompt: "Cover the batch queue cancellation path with a browser test that asserts current source state, queue counters, and the retryable cancellation message."

- [ ] Add large-file benchmark harness
  Prompt: "Create a repeatable local benchmark script that measures transfer time, transcription time, and package-export time for larger fixture files."

## Docs and Ops Tasks

- [ ] Link this plan from the repo docs more prominently
  Prompt: "Make the active implementation plan discoverable from the README and agent guidance without cluttering the landing narrative."

- [x] Document temp-checkout git publishing workaround
  Prompt: "Record the current workaround for publishing when the workspace-local `.git` is unusable so the next agent does not rediscover it from scratch."
  Notes: Completed on 2026-04-02 in `README.md` and `AGENT.md`, including the `gh auth setup-git` recovery path and the fetch/reset requirement before each temp-checkout publish.
  Verified: `rg -n "temp checkout|gh auth setup-git|fetch origin|README asset workflow" README.md AGENT.md`

- [ ] Document README asset workflow churn on `main`
  Prompt: "Explain that the README asset workflow can add follow-up commits on `main`, so temp-checkout publishing should always fetch and reset before staging new work."

## Session Ledger
(append only, do not delete history)

- 2026-04-02: Added `Improve live batch queue status` and completed it in the same pass.
- 2026-04-02: Added `Add queue completion toast and summary state` as the next follow-on frontend task.
- 2026-04-02: Added `Remove Playwright color warnings` after re-reading the plan during verification cleanup.
- 2026-04-02: Added `Surface the latest finished batch session from the landing page` before implementing the queue completion summary flow.
- 2026-04-02: Completed `Add queue completion toast and summary state` after web unit, lint, build, and Playwright verification.
- 2026-04-02: Added `Add per-source ETA hints to the active queue card` as the next frontend queue follow-up.
- 2026-04-02: Added `Add a smoke assertion for the finished batch summary action row` before fixing the remaining Playwright color-env warning.
- 2026-04-03: Completed `Add contribution bars to the aggregate export summary` after targeted lint and Playwright verification.
- 2026-04-03: Added `Sort ready sources by current export contribution in the aggregate summary` as the next aggregate-export follow-up.
- 2026-04-02: Completed `Remove Playwright color warnings` after confirming `npm run test:e2e` no longer prints the startup warning.
- 2026-04-02: Added `Add a console-warning guard around the browser smoke runner` as the next testing follow-up.
- 2026-04-02: Added `Document README asset workflow churn on main` before writing down the git publishing workaround.
- 2026-04-02: Completed `Document temp-checkout git publishing workaround` after updating `README.md` and `AGENT.md`.
- 2026-04-02: Added `Add dismiss action for stale finished batch shortcuts` before surfacing the latest finished batch session from the landing page.
- 2026-04-02: Completed `Surface the latest finished batch session from the landing page` after adding the persisted landing shortcut and passing web test, lint, and build verification.
- 2026-04-03: Completed `Add dismiss action for stale finished batch shortcuts` after web unit, lint, and targeted Playwright verification.
- 2026-04-03: Added `Preview failed source names in the saved batch shortcut` as the next landing-session follow-up.
- 2026-04-03: Completed `Add per-job retry from batch workspace` after web unit, backend API, and targeted Playwright verification.
- 2026-04-03: Added `Preserve failed-upload retry readiness across reloads` as the follow-up to the new batch retry flow.
- 2026-04-03: Completed `Preview failed source names in the saved batch shortcut` after web unit and targeted Playwright verification.
- 2026-04-03: Added `Open saved batch workspaces with failed sources surfaced first` as the next landing-session follow-up.
- 2026-04-03: Completed `Open saved batch workspaces with failed sources surfaced first` after web unit and targeted Playwright verification.
- 2026-04-03: Added `Add issue-only toggle for saved batch triage` as the next queue-triage follow-up.
- 2026-04-03: Completed `Add issue-only toggle for saved batch triage` after focused web-unit and Playwright verification.
- 2026-04-03: Added `Persist saved-batch triage scope in the URL` as the next queue-triage follow-up.
- 2026-04-03: Completed `Persist saved-batch triage scope in the URL` after installing frontend dependencies and passing focused web-unit and Playwright verification.
- 2026-04-03: Added `Persist selected batch source in the URL` as the next batch-workspace deep-link follow-up.
- 2026-04-03: Completed `Persist selected batch source in the URL` after focused web-unit and Playwright verification.
- 2026-04-03: Added `Add previous and next source navigation in the batch workspace` as the next batch-review follow-up.
- 2026-04-03: Completed `Add previous and next source navigation in the batch workspace` after installing frontend dependencies and passing focused web-unit and Playwright verification.
- 2026-04-03: Added `Add keyboard shortcuts for ready-source navigation in the batch workspace` as the next batch-review follow-up.
- 2026-04-03: Completed `Add keyboard shortcuts for ready-source navigation in the batch workspace` after installing frontend dependencies and passing focused web-unit and Playwright verification.
- 2026-04-03: Added `Add first and last ready-source jump controls in the batch workspace` as the next batch-review follow-up.
- 2026-04-03: Completed `Add first and last ready-source jump controls in the batch workspace` after installing frontend dependencies and passing focused web-unit and Playwright verification.
- 2026-04-03: Added `Add ready-source position badges to batch queue cards` as the next batch-review follow-up.
- 2026-04-03: Completed `Add per-source ETA hints to the active queue card` after installing frontend dependencies, passing focused web-unit coverage, and linting only the touched files because the repo-wide lint still reports an older warning in `batch-workspace.tsx`.
- 2026-04-03: Added `Add transfer-basis labels to batch ETA hints` as the next queue-estimation follow-up.
- 2026-04-03: Completed `Add export preset selector` after refreshing the editable backend install, rebuilding the web app, and passing targeted package-export pytest and Playwright coverage.
- 2026-04-03: Completed `Add audio-only export companion` within the same preset pass by shipping wav and metadata-only selected package exports.
- 2026-04-03: Added `Add batch export preset selector` as the follow-up so batch downloads match the new single-workspace preset choices.
- 2026-04-03: Completed `Add batch export preset selector` after installing frontend dependencies, refreshing the editable backend install, and passing targeted build, batch package-export pytest, and Playwright verification.
- 2026-04-03: Added `Persist batch export preset choice per batch session` as the next aggregate-export follow-up.
- 2026-04-03: Completed `Persist batch export preset choice per batch session` after targeted batch-session unit coverage and a refreshed Playwright batch export flow that proves reload and reopen behavior.
- 2026-04-03: Added `Persist batch export preset in the URL` as the next aggregate-export deep-link follow-up.
- 2026-04-03: Completed `Persist batch quality threshold in the URL` after adding the validated `threshold` query param, preserving it across reloads, and passing focused unit plus Playwright verification.
- 2026-04-03: Added `Add quality-threshold quick presets in the batch workspace` as the next aggregate-export UX follow-up.
- 2026-04-03: Completed `Add quality-threshold quick presets in the batch workspace` after installing frontend dependencies and passing focused web-unit plus Playwright verification.
- 2026-04-03: Added `Show eligible clip counts inside batch threshold presets` as the next aggregate-export UX follow-up.
- 2026-04-03: Completed `Preserve failed-upload retry readiness across reloads` after adding IndexedDB-backed browser source persistence, rebuilding the web app, and passing the saved-batch retry Playwright coverage.
- 2026-04-03: Added `Warn when browser source persistence is unavailable for failed batch retries` as the next retry-reliability follow-up.
- 2026-04-03: Completed `Warn when browser source persistence is unavailable for failed batch retries` after surfacing tab-only retry cache warnings and passing the focused saved-batch retry Playwright coverage.
- 2026-04-03: Completed `Show per-job eligible clip totals in the batch aggregate export summary` after installing frontend dependencies and passing focused lint plus Playwright verification.
- 2026-04-03: Added `Add source-jump actions to the aggregate export summary` as the next aggregate-review follow-up.
- 2026-04-03: Completed `Show eligible duration totals in the aggregate export summary` after installing frontend dependencies and passing focused Playwright batch export verification.
- 2026-04-03: Added `Show each ready source's share of eligible duration in the aggregate export summary` as the next aggregate-review follow-up.
- 2026-04-03: Completed `Show each ready source's share of eligible duration in the aggregate export summary` after reinstalling frontend dependencies in the worktree, passing focused lint, and extending the existing batch export Playwright coverage.
- 2026-04-03: Added `Add contribution bars to the aggregate export summary` as the next aggregate-review follow-up.
- 2026-04-03: Completed `Sort ready sources by current export contribution in the aggregate summary` after sorting the ready-source rows by eligible duration, passing focused lint, and rerunning the targeted batch export Playwright flow.
- 2026-04-03: Added `Add contribution rank badges to the aggregate export summary` as the next aggregate-export scanability follow-up.
- 2026-04-03: Completed `Add contribution rank badges to the aggregate export summary` after reinstalling frontend dependencies, passing focused lint, and rerunning the targeted batch export Playwright flow.
- 2026-04-03: Added `Add a contributors-only toggle to the aggregate export summary` as the next aggregate-export focus follow-up.
- 2026-04-03: Completed `Add a broader-threshold recovery action when the aggregate export summary is empty` after reinstalling frontend dependencies, passing focused batch-threshold unit coverage, and rerunning the targeted batch export Playwright flow.
- 2026-04-03: Added `Preview which ready sources return after a broader-threshold recovery jump` as the next aggregate-export recovery follow-up.
- 2026-04-03: Completed `Preview which ready sources return after a broader-threshold recovery jump` after installing frontend dependencies in the worktree, passing focused lint, and rerunning the targeted batch export Playwright flow.
- 2026-04-03: Added `Add inspect actions to broader-threshold recovery previews` as the next aggregate-export recovery follow-up.
- 2026-04-03: Completed `Add inspect actions to broader-threshold recovery previews` after reinstalling frontend dependencies in the worktree, passing focused lint, and rerunning the targeted batch export Playwright flow.
- 2026-04-03: Added `Show projected eligible duration in broader-threshold recovery previews` as the next aggregate-export recovery follow-up.
- 2026-04-03: Completed `Show projected eligible duration in broader-threshold recovery previews` after reinstalling frontend dependencies in the worktree, passing focused lint, and rerunning the targeted batch export Playwright flow.
- 2026-04-03: Added `Show total projected eligible duration in the broader-threshold recovery summary` as the next aggregate-export recovery follow-up.
- 2026-04-03: Completed `Add a ready-only filter to the batch queue` after reinstalling frontend dependencies in the worktree and passing focused web-unit and Playwright verification.
- 2026-04-03: Added `Persist ready-only batch queue scope in the URL` as the next batch-review deep-link follow-up.
- 2026-04-03: Completed `Persist ready-only batch queue scope in the URL` after reinstalling frontend dependencies in the worktree and passing focused web-unit plus reload-aware Playwright verification.
- 2026-04-03: Added `Add ready-review reopen action to saved batch shortcuts` as the next batch-review resume follow-up.
- 2026-04-03: Completed `Add ready-review reopen action to saved batch shortcuts` after reinstalling frontend dependencies, passing focused batch-focus unit coverage, and rerunning the saved-batch landing Playwright reopen scenarios.
