import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, "../docs/readme");
const baseUrl = process.env.README_CAPTURE_BASE_URL ?? "http://127.0.0.1:3000";
const recentJobsKey = "clipmine:recent-jobs:v1";
const batchSessionsKey = "clipmine:batches:v1";
const selectedClipsKeyPrefix = "clipmine:selected:";

const jobAlpha = createDemoJob({
  jobId: "demo-job-alpha",
  fileName: "customer-interview.mp4",
  topScore: 96,
  transcriptPreview: "We need a cleaner intake layer before the next training run.",
});
const jobBeta = createDemoJob({
  jobId: "demo-job-beta",
  fileName: "founder-update.mp4",
  topScore: 88,
  transcriptPreview: "The shortlist is strong enough to package this afternoon.",
});

const batchSession = {
  batchId: "demo-batch",
  label: "3 sources queued",
  createdAt: "2026-04-02T12:00:00.000Z",
  updatedAt: "2026-04-02T12:10:00.000Z",
  qualityThreshold: 84,
  items: [
    {
      id: "upload-1",
      fileName: jobAlpha.sourceVideo.file_name,
      sizeBytes: jobAlpha.sourceVideo.size_bytes,
      jobId: jobAlpha.jobId,
      status: "ready",
      uploadPhase: "complete",
      uploadProgress: 100,
      error: null,
      updatedAt: jobAlpha.updatedAt,
    },
    {
      id: "upload-2",
      fileName: jobBeta.sourceVideo.file_name,
      sizeBytes: jobBeta.sourceVideo.size_bytes,
      jobId: jobBeta.jobId,
      status: "processing",
      uploadPhase: "complete",
      uploadProgress: 100,
      error: null,
      updatedAt: jobBeta.updatedAt,
    },
    {
      id: "upload-3",
      fileName: "podcast-cutdown.mp4",
      sizeBytes: 28_500_000,
      jobId: null,
      status: "queued",
      uploadPhase: "queued",
      uploadProgress: 0,
      error: null,
      updatedAt: "2026-04-02T12:08:00.000Z",
    },
  ],
};

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  colorScheme: "dark",
  deviceScaleFactor: 1.5,
});

await context.addInitScript(
  ({ recentJobsKey, batchSessionsKey, selectedClipsKeyPrefix, recentJobs, batchSession }) => {
    window.localStorage.setItem(recentJobsKey, JSON.stringify(recentJobs));
    window.localStorage.setItem(batchSessionsKey, JSON.stringify([batchSession]));
    window.localStorage.setItem(`${selectedClipsKeyPrefix}demo-job-alpha`, JSON.stringify(["demo-job-alpha-clip-001"]));
  },
  {
    recentJobsKey,
    batchSessionsKey,
    selectedClipsKeyPrefix,
    recentJobs: [
      {
        jobId: jobAlpha.jobId,
        fileName: jobAlpha.sourceVideo.file_name,
        updatedAt: jobAlpha.updatedAt,
        clipCount: jobAlpha.summary.clip_count,
        topScore: jobAlpha.summary.top_score,
        durationSeconds: jobAlpha.sourceVideo.duration_seconds,
        language: jobAlpha.language,
      },
      {
        jobId: jobBeta.jobId,
        fileName: jobBeta.sourceVideo.file_name,
        updatedAt: jobBeta.updatedAt,
        clipCount: jobBeta.summary.clip_count,
        topScore: jobBeta.summary.top_score,
        durationSeconds: jobBeta.sourceVideo.duration_seconds,
        language: jobBeta.language,
      },
    ],
    batchSession,
  }
);

await context.route("**/api/jobs/demo-job-alpha", async (route) => {
  await route.fulfill(jsonResponse(jobAlpha));
});
await context.route("**/api/jobs/demo-job-beta", async (route) => {
  await route.fulfill(jsonResponse(jobBeta));
});
await context.route("**/api/jobs/demo-job-alpha/video", async (route) => {
  await route.fulfill({ status: 200, contentType: "video/mp4", body: "" });
});
await context.route("**/api/jobs/demo-job-beta/video", async (route) => {
  await route.fulfill({ status: 200, contentType: "video/mp4", body: "" });
});
await context.route("**/api/exports/batch-package", async (route) => {
  await route.fulfill({
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="clipmine-batch-export-demo.zip"',
    },
    body: "",
  });
});

await capturePage(context, "/", "landing-page.png");
await capturePage(context, "/jobs/demo-job-alpha?tab=clips", "review-workspace.png");
await capturePage(context, "/jobs/demo-job-alpha?tab=timeline", "timeline-workspace.png");
await capturePage(context, "/jobs/demo-job-alpha?tab=export", "export-workspace.png");
await capturePage(context, "/batches/demo-batch", "batch-workspace.png");

await writeFile(path.join(outputDir, "landing-overview.svg"), buildLandingOverviewSvg(), "utf8");
await writeFile(path.join(outputDir, "workflow-compression.svg"), buildWorkflowCompressionSvg(), "utf8");
await writeFile(path.join(outputDir, "batch-throughput.svg"), buildBatchThroughputSvg(), "utf8");
await writeFile(path.join(outputDir, "package-structure.svg"), buildPackageStructureSvg(), "utf8");

await browser.close();

async function capturePage(context, pathname, fileName) {
  const page = await context.newPage();
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      problems.push(`[console:${message.type()}] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    problems.push(`[pageerror] ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown error";
    const requestUrl = request.url();
    if (errorText === "net::ERR_ABORTED" && requestUrl.includes("_rsc=")) {
      return;
    }
    problems.push(`[requestfailed] ${request.method()} ${requestUrl} :: ${errorText}`);
  });
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "networkidle" });
  if (problems.length > 0) {
    await page.close();
    throw new Error(`Browser smoke failed for ${pathname}:\n${problems.join("\n")}`);
  }
  await page.screenshot({
    path: path.join(outputDir, fileName),
    fullPage: true,
    type: "png",
  });
  await page.close();
}

function jsonResponse(payload) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(payload),
  };
}

function createDemoJob({ jobId, fileName, topScore, transcriptPreview }) {
  const clips = [
    {
      id: `${jobId}-clip-001`,
      text: transcriptPreview,
      start: 12.4,
      end: 14.9,
      duration: 2.5,
      confidence: 0.95,
      speech_rate: 2.8,
      energy: 0.82,
      silence_ratio: 0.06,
      instability: 0.08,
      score: topScore,
      quality_label: "Excellent",
      explanation: "High confidence, clean boundary, and strong delivery.",
      source_video_id: jobId,
      playback: {
        url: `/api/jobs/${jobId}/video`,
        start: 12.4,
        end: 14.9,
      },
      audio_features: {
        volume: { value: 0.82, normalized: 0.82 },
        speech_rate: { value: 2.8, normalized: 0.7 },
        snr: { value: 0.84, normalized: 0.84 },
        spectral: {
          centroid_hz: { value: 1900, normalized: 0.53 },
          bandwidth_hz: { value: 1260, normalized: 0.45 },
          rolloff_hz: { value: 3380, normalized: 0.61 },
          flatness: { value: 0.14, normalized: 0.14 },
          zero_crossing_rate: { value: 0.05, normalized: 0.05 },
        },
      },
      linguistic_features: {
        word_count: 9,
        lexical_diversity: 0.92,
        filler_word_count: 0,
        filler_words: [],
        pos_distribution: { noun: 0.28, verb: 0.22 },
      },
      word_alignments: [
        { token: "We", start: 12.4, end: 12.61, confidence: 0.96 },
        { token: "run.", start: 14.45, end: 14.9, confidence: 0.91 },
      ],
      visual_features: {
        sampled_frame_count: 14,
        face_detection: { value: 0.96, normalized: 0.96 },
        mouth_movement: { value: 0.79, normalized: 0.79 },
        visibility: { value: 0.93, normalized: 0.93 },
      },
      quality_breakdown: {
        transcription_confidence: 0.95,
        pacing: 0.8,
        acoustic_signal: 0.84,
        continuity: 0.92,
        stability: 0.88,
        linguistic_clarity: 0.76,
        visual_readiness: 0.8,
        boundary_cleanliness: 0.94,
        speech_density: 0.84,
        dedupe_confidence: 0.98,
        overall: topScore / 100,
      },
      quality_reasoning: {
        summary: "Strong training clip.",
        strengths: ["High confidence", "Boundary clean"],
        cautions: [],
      },
      candidate_metrics: {
        pause_count: 0,
        max_gap_seconds: 0.08,
        speech_density: 0.84,
        low_confidence_ratio: 0,
        leading_filler_ratio: 0,
        trailing_filler_ratio: 0,
        boundary_punctuation_strength: 1,
      },
      selection_recommendation: "shortlist",
      quality_penalties: [],
      tags: ["training-ready", "boundary-clean", "av-ready"],
      recommended_use: ["training", "annotation"],
      embedding_vector: null,
    },
  ];

  return {
    jobId,
    status: "ready",
    progressPhase: "ready",
    error: null,
    sourceVideo: {
      id: `source-${jobId}`,
      file_name: fileName,
      content_type: "video/mp4",
      size_bytes: 19_824_297,
      duration_seconds: 299.28,
      url: `/api/jobs/${jobId}/video`,
    },
    summary: {
      duration_seconds: 299.28,
      transcript_preview: transcriptPreview,
      clip_count: clips.length,
      excellent_count: 1,
      good_count: 0,
      weak_count: 0,
      average_score: topScore,
      top_score: topScore,
      shortlist_recommended_count: 1,
    },
    clips,
    timeline: [
      { start: 0, end: 60, score: 58, quality_label: "Good", top_clip_id: null },
      { start: 60, end: 120, score: topScore, quality_label: "Excellent", top_clip_id: clips[0].id },
      { start: 120, end: 180, score: 73, quality_label: "Good", top_clip_id: null },
      { start: 180, end: 240, score: 48, quality_label: "Weak", top_clip_id: null },
    ],
    language: "en",
    processingTimings: {
      extracting_audio: 335,
      transcribing: 8172,
      segmenting: 2,
      scoring: 6232,
      total: 14770,
    },
    warnings: [],
    processingStats: {
      source_duration_seconds: 299.28,
      transcript_word_count: 370,
      candidate_clip_count: 50,
      discarded_candidate_count: 4,
      deduped_candidate_count: 3,
      shortlist_recommended_count: 8,
      clip_count: 50,
      timeline_bin_count: 48,
    },
    createdAt: "2026-04-02T10:00:00.000Z",
    updatedAt: "2026-04-02T10:27:00.000Z",
  };
}

function buildLandingOverviewSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1400" height="820" viewBox="0 0 1400 820" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1400" height="820" rx="32" fill="#091018"/>
  <rect x="20" y="20" width="1360" height="780" rx="28" fill="#0E1621" stroke="#1E2B3B"/>
  <rect x="52" y="44" width="1296" height="72" rx="22" fill="#101A26" stroke="#1E2B3B"/>
  <circle cx="96" cy="80" r="20" fill="#141F2C"/>
  <text x="86" y="86" fill="#8CBBD6" font-family="Arial, sans-serif" font-size="15" font-weight="700">CM</text>
  <text x="130" y="76" fill="#E9F0F7" font-family="Arial, sans-serif" font-size="24" font-weight="700">ClipMine AI</text>
  <text x="130" y="101" fill="#8FA0B5" font-family="Arial, sans-serif" font-size="16">Speech clip curation for training workflows.</text>
  <rect x="936" y="58" width="120" height="40" rx="20" fill="#121C28" stroke="#29384A"/>
  <rect x="1070" y="58" width="112" height="40" rx="20" fill="#182637" stroke="#2E425A"/>
  <rect x="1194" y="58" width="118" height="40" rx="20" fill="#82DFFF"/>
  <text x="962" y="83" fill="#B9C7D7" font-family="Arial, sans-serif" font-size="16">Recent</text>
  <text x="1102" y="83" fill="#B9C7D7" font-family="Arial, sans-serif" font-size="16">Roadmap</text>
  <text x="1226" y="83" fill="#08202A" font-family="Arial, sans-serif" font-size="16" font-weight="700">Upload video</text>
  <text x="72" y="194" fill="#7BD9F3" font-family="Arial, sans-serif" font-size="15" letter-spacing="3">TRAINING-READY SPEECH CURATION</text>
  <text x="72" y="274" fill="#F0F5FA" font-family="Arial, sans-serif" font-size="66" font-weight="700">One workspace for upload review</text>
  <text x="72" y="340" fill="#F0F5FA" font-family="Arial, sans-serif" font-size="66" font-weight="700">and package handoff.</text>
  <text x="74" y="404" fill="#8FA0B5" font-family="Arial, sans-serif" font-size="22">Queue one source or a full batch, inspect ranked clips against the original video,</text>
  <text x="74" y="438" fill="#8FA0B5" font-family="Arial, sans-serif" font-size="22">and export media, spectrograms, and manifest metadata from one operator surface.</text>
  <rect x="72" y="578" width="184" height="56" rx="22" fill="#82DFFF"/>
  <rect x="272" y="578" width="204" height="56" rx="22" fill="#121C28" stroke="#29384A"/>
  <text x="118" y="613" fill="#08202A" font-family="Arial, sans-serif" font-size="20" font-weight="700">Upload video</text>
  <text x="319" y="613" fill="#C2CEDA" font-family="Arial, sans-serif" font-size="20">Explore workspace</text>
  <rect x="72" y="676" width="210" height="96" rx="24" fill="#121C28" stroke="#29384A"/>
  <rect x="290" y="676" width="210" height="96" rx="24" fill="#121C28" stroke="#29384A"/>
  <rect x="508" y="676" width="226" height="96" rx="24" fill="#121C28" stroke="#29384A"/>
  <text x="96" y="714" fill="#7BD9F3" font-family="Arial, sans-serif" font-size="13" letter-spacing="2">BEST CLIPS</text>
  <text x="96" y="748" fill="#E9F0F7" font-family="Arial, sans-serif" font-size="22" font-weight="700">Rank strong speech</text>
  <text x="314" y="714" fill="#7BD9F3" font-family="Arial, sans-serif" font-size="13" letter-spacing="2">BATCH QUEUE</text>
  <text x="314" y="748" fill="#E9F0F7" font-family="Arial, sans-serif" font-size="22" font-weight="700">Keep sources grouped</text>
  <text x="532" y="714" fill="#7BD9F3" font-family="Arial, sans-serif" font-size="13" letter-spacing="2">TRAINING PACKAGE</text>
  <text x="532" y="748" fill="#E9F0F7" font-family="Arial, sans-serif" font-size="22" font-weight="700">Export media + spectrograms</text>
  <rect x="816" y="156" width="520" height="566" rx="30" fill="#101823" stroke="#223247"/>
  <rect x="848" y="188" width="456" height="70" rx="20" fill="#121D2A" stroke="#25354A"/>
  <text x="878" y="220" fill="#7BD9F3" font-family="Arial, sans-serif" font-size="13" letter-spacing="2">WORKSPACE PREVIEW</text>
  <text x="878" y="247" fill="#E9F0F7" font-family="Arial, sans-serif" font-size="28" font-weight="700">Operator workspace</text>
  <rect x="848" y="286" width="176" height="220" rx="24" fill="#121C28" stroke="#26384D"/>
  <text x="874" y="320" fill="#8FA0B5" font-family="Arial, sans-serif" font-size="14">SELECTED PACKAGE</text>
  <text x="874" y="398" fill="#F0F5FA" font-family="Arial, sans-serif" font-size="76" font-weight="700">08</text>
  <text x="874" y="440" fill="#8FA0B5" font-family="Arial, sans-serif" font-size="16">Linked media, spectrograms, and manifest</text>
  <rect x="1048" y="286" width="256" height="92" rx="22" fill="#121C28" stroke="#26384D"/>
  <rect x="1048" y="392" width="256" height="92" rx="22" fill="#121C28" stroke="#26384D"/>
  <text x="1072" y="322" fill="#7BD9F3" font-family="Arial, sans-serif" font-size="13" letter-spacing="2">QUEUE</text>
  <text x="1072" y="352" fill="#E9F0F7" font-family="Arial, sans-serif" font-size="24" font-weight="700">3 uploads grouped</text>
  <text x="1072" y="428" fill="#7BD9F3" font-family="Arial, sans-serif" font-size="13" letter-spacing="2">TIMELINE</text>
  <text x="1072" y="458" fill="#E9F0F7" font-family="Arial, sans-serif" font-size="24" font-weight="700">48 usefulness bins</text>
  <rect x="848" y="534" width="456" height="156" rx="24" fill="#121C28" stroke="#26384D"/>
  <text x="878" y="568" fill="#8FA0B5" font-family="Arial, sans-serif" font-size="14">TOP CLIPS</text>
  <rect x="878" y="596" width="396" height="28" rx="14" fill="#0E1621"/>
  <rect x="878" y="596" width="348" height="28" rx="14" fill="#82DFFF"/>
  <rect x="878" y="636" width="396" height="28" rx="14" fill="#0E1621"/>
  <rect x="878" y="636" width="288" height="28" rx="14" fill="#5C6C7F"/>
  <text x="1126" y="617" fill="#07212A" font-family="Arial, sans-serif" font-size="14" font-weight="700">97 / 100</text>
  <text x="1080" y="657" fill="#D4DEE8" font-family="Arial, sans-serif" font-size="14">84 / 100</text>
</svg>`;
}

function buildWorkflowCompressionSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="660" viewBox="0 0 1200 660" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="660" rx="28" fill="#0B1118"/>
  <rect x="24" y="24" width="1152" height="612" rx="24" fill="#101822" stroke="#1E2C3C"/>
  <text x="72" y="96" fill="#E8EEF6" font-family="Arial, sans-serif" font-size="34" font-weight="700">Illustrative workflow compression</text>
  <text x="72" y="132" fill="#91A2B7" font-family="Arial, sans-serif" font-size="18">A reasonable model of how ClipMine reduces the time spent scrubbing raw footage and hand-building training packages.</text>
  <text x="72" y="184" fill="#63D8F7" font-family="Arial, sans-serif" font-size="13" letter-spacing="3">MANUAL REVIEW</text>
  <text x="910" y="184" fill="#63D8F7" font-family="Arial, sans-serif" font-size="13" letter-spacing="3">CLIPMINE</text>
  ${buildWorkflowBar({ y: 230, label: "Find usable segments in one source", manual: 42, product: 11 })}
  ${buildWorkflowBar({ y: 340, label: "Prepare clip files + manifest", manual: 18, product: 4 })}
  ${buildWorkflowBar({ y: 450, label: "Review five uploads in one pass", manual: 120, product: 28 })}
  <text x="72" y="584" fill="#6F8196" font-family="Arial, sans-serif" font-size="14">Values are illustrative workflow estimates, not benchmark claims.</text>
</svg>`;
}

function buildWorkflowBar({ y, label, manual, product }) {
  const manualWidth = Math.round((manual / 140) * 560);
  const productWidth = Math.round((product / 140) * 560);
  return `
  <text x="72" y="${y - 18}" fill="#D6E0EA" font-family="Arial, sans-serif" font-size="18">${label}</text>
  <rect x="72" y="${y}" width="560" height="34" rx="17" fill="#151F2B"/>
  <rect x="72" y="${y}" width="${manualWidth}" height="34" rx="17" fill="#33465A"/>
  <text x="650" y="${y + 23}" fill="#D6E0EA" font-family="Arial, sans-serif" font-size="16">${manual} min</text>
  <rect x="720" y="${y}" width="360" height="34" rx="17" fill="#151F2B"/>
  <rect x="720" y="${y}" width="${productWidth}" height="34" rx="17" fill="#63D8F7"/>
  <text x="1100" y="${y + 23}" fill="#D6E0EA" font-family="Arial, sans-serif" font-size="16">${product} min</text>`;
}

function buildBatchThroughputSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="660" viewBox="0 0 1200 660" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="660" rx="28" fill="#0B1118"/>
  <rect x="24" y="24" width="1152" height="612" rx="24" fill="#101822" stroke="#1E2C3C"/>
  <text x="72" y="96" fill="#E8EEF6" font-family="Arial, sans-serif" font-size="34" font-weight="700">Batch review scales the same workflow</text>
  <text x="72" y="132" fill="#91A2B7" font-family="Arial, sans-serif" font-size="18">Queued uploads hold multiple sources together so the user can export top clips across the full run instead of treating each file as a separate session.</text>
  <line x1="96" y1="540" x2="1110" y2="540" stroke="#243447" stroke-width="2"/>
  <line x1="96" y1="180" x2="96" y2="540" stroke="#243447" stroke-width="2"/>
  <text x="72" y="562" fill="#6F8196" font-family="Arial, sans-serif" font-size="14">Start</text>
  <text x="280" y="562" fill="#6F8196" font-family="Arial, sans-serif" font-size="14">Uploads queued</text>
  <text x="520" y="562" fill="#6F8196" font-family="Arial, sans-serif" font-size="14">Jobs processing</text>
  <text x="760" y="562" fill="#6F8196" font-family="Arial, sans-serif" font-size="14">Threshold review</text>
  <text x="1010" y="562" fill="#6F8196" font-family="Arial, sans-serif" font-size="14">One package export</text>
  <path d="M96 500 C180 470 220 420 320 390 C420 360 460 290 560 250 C650 214 710 210 810 186 C910 162 980 152 1110 144" stroke="#63D8F7" stroke-width="8" stroke-linecap="round"/>
  <circle cx="96" cy="500" r="9" fill="#63D8F7"/>
  <circle cx="320" cy="390" r="9" fill="#63D8F7"/>
  <circle cx="560" cy="250" r="9" fill="#63D8F7"/>
  <circle cx="810" cy="186" r="9" fill="#63D8F7"/>
  <circle cx="1110" cy="144" r="9" fill="#63D8F7"/>
  <rect x="756" y="292" width="280" height="126" rx="18" fill="#121C28" stroke="#243447"/>
  <text x="784" y="334" fill="#E8EEF6" font-family="Arial, sans-serif" font-size="22" font-weight="700">What changes</text>
  <text x="784" y="364" fill="#91A2B7" font-family="Arial, sans-serif" font-size="16">• one queue instead of one-off uploads</text>
  <text x="784" y="392" fill="#91A2B7" font-family="Arial, sans-serif" font-size="16">• one threshold across every ready job</text>
  <text x="784" y="420" fill="#91A2B7" font-family="Arial, sans-serif" font-size="16">• one combined package for training prep</text>
</svg>`;
}

function buildPackageStructureSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="560" viewBox="0 0 1200 560" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="560" rx="28" fill="#0B1118"/>
  <rect x="24" y="24" width="1152" height="512" rx="24" fill="#101822" stroke="#1E2C3C"/>
  <text x="72" y="96" fill="#E8EEF6" font-family="Arial, sans-serif" font-size="34" font-weight="700">Training package structure</text>
  <text x="72" y="132" fill="#91A2B7" font-family="Arial, sans-serif" font-size="18">The primary export bundles selected clip media, optional spectrograms, and a manifest that keeps every file linked to clip-level metadata.</text>
  <rect x="72" y="184" width="486" height="288" rx="24" fill="#121C28" stroke="#27384B"/>
  <text x="100" y="226" fill="#7BD9F3" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">ZIP LAYOUT</text>
  <text x="100" y="272" fill="#E8EEF6" font-family="Courier New, monospace" font-size="22">clipmine-export-&lt;jobId&gt;/</text>
  <text x="132" y="312" fill="#D6E0EA" font-family="Courier New, monospace" font-size="20">manifest.json</text>
  <text x="132" y="348" fill="#D6E0EA" font-family="Courier New, monospace" font-size="20">clips/</text>
  <text x="164" y="384" fill="#D6E0EA" font-family="Courier New, monospace" font-size="20">clip_001__&lt;clipId&gt;.mp4</text>
  <text x="164" y="420" fill="#D6E0EA" font-family="Courier New, monospace" font-size="20">clip_002__&lt;clipId&gt;.mp4</text>
  <text x="132" y="456" fill="#D6E0EA" font-family="Courier New, monospace" font-size="20">spectrograms/clip_001__&lt;clipId&gt;.png</text>
  <rect x="622" y="184" width="506" height="288" rx="24" fill="#121C28" stroke="#27384B"/>
  <text x="650" y="226" fill="#7BD9F3" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">MANIFEST LINKS</text>
  <text x="650" y="276" fill="#E8EEF6" font-family="Arial, sans-serif" font-size="20" font-weight="700">Each clip keeps:</text>
  <text x="650" y="316" fill="#91A2B7" font-family="Arial, sans-serif" font-size="18">• ordinal and stable file name</text>
  <text x="650" y="348" fill="#91A2B7" font-family="Arial, sans-serif" font-size="18">• relative path inside the package</text>
  <text x="650" y="380" fill="#91A2B7" font-family="Arial, sans-serif" font-size="18">• transcript, timings, scores, and tags</text>
  <text x="650" y="412" fill="#91A2B7" font-family="Arial, sans-serif" font-size="18">• selection recommendation, penalties, and spectrogram path</text>
</svg>`;
}
