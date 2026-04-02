import numpy as np

from clipmine_api.pipeline_types import CandidateClip, WordToken
from clipmine_api.scoring import score_candidate_clips


def test_score_candidate_clips_ranks_stronger_signal_higher() -> None:
    sample_rate = 16000
    audio = np.zeros(sample_rate * 4, dtype=np.float32)
    audio[: sample_rate * 2] = 0.2
    audio[sample_rate * 2 :] = 0.05

    strong_clip = CandidateClip(
        text="Strong clip example.",
        start=0.0,
        end=2.0,
        words=[
            WordToken(text="Strong", raw_text="Strong", start=0.0, end=0.55, probability=0.95),
            WordToken(text="clip", raw_text=" clip", start=0.55, end=1.1, probability=0.94),
            WordToken(text="example.", raw_text=" example.", start=1.1, end=2.0, probability=0.93),
        ],
    )
    weak_clip = CandidateClip(
        text="Weak clip example.",
        start=2.0,
        end=4.0,
        words=[
            WordToken(text="Weak", raw_text="Weak", start=2.0, end=2.6, probability=0.62),
            WordToken(text="clip", raw_text=" clip", start=2.6, end=3.15, probability=0.6),
            WordToken(text="example.", raw_text=" example.", start=3.15, end=4.0, probability=0.58),
        ],
    )

    scored = score_candidate_clips(
        [strong_clip, weak_clip],
        audio_samples=audio,
        sample_rate=sample_rate,
        source_video_id="job123",
        video_url="/api/jobs/job123/video",
    )

    assert scored[0].score > scored[1].score
    assert scored[0].quality_label in {"Excellent", "Good"}
    assert scored[1].quality_label in {"Good", "Weak"}
    assert scored[0].playback.url == "/api/jobs/job123/video"

