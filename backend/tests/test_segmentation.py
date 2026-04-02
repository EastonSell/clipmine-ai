from clipmine_api.pipeline_types import WordToken
from clipmine_api.segmentation import segment_words, segment_words_detailed


def test_segment_words_splits_on_punctuation_and_gap() -> None:
    words = [
        WordToken(text="This", raw_text="This", start=0.0, end=0.25, probability=0.96),
        WordToken(text="is", raw_text=" is", start=0.25, end=0.42, probability=0.97),
        WordToken(text="clean.", raw_text=" clean.", start=0.42, end=0.95, probability=0.95),
        WordToken(text="Another", raw_text=" Another", start=1.6, end=1.95, probability=0.94),
        WordToken(text="short", raw_text=" short", start=1.95, end=2.25, probability=0.93),
        WordToken(text="clip.", raw_text=" clip.", start=2.25, end=2.85, probability=0.92),
    ]

    clips = segment_words(words)

    assert len(clips) == 2
    assert clips[0].text == "This is clean."
    assert clips[1].text == "Another short clip."
    assert all(0.9 <= clip.duration <= 3.2 for clip in clips)


def test_segment_words_trims_edge_fillers_and_tracks_metrics() -> None:
    words = [
        WordToken(text="Um", raw_text="Um", start=0.0, end=0.14, probability=0.97),
        WordToken(text="we", raw_text=" we", start=0.14, end=0.32, probability=0.95),
        WordToken(text="need", raw_text=" need", start=0.32, end=0.64, probability=0.94),
        WordToken(text="clean", raw_text=" clean", start=0.64, end=0.96, probability=0.95),
        WordToken(text="labels.", raw_text=" labels.", start=0.96, end=1.42, probability=0.96),
        WordToken(text="uh", raw_text=" uh", start=1.42, end=1.58, probability=0.98),
    ]

    clips = segment_words(words)

    assert len(clips) == 1
    assert clips[0].text == "We need clean labels."
    assert clips[0].candidate_metrics.leading_filler_ratio == 0.0
    assert clips[0].candidate_metrics.trailing_filler_ratio == 0.0
    assert clips[0].candidate_metrics.boundary_punctuation_strength == 1.0


def test_segment_words_detailed_rejects_low_confidence_candidate() -> None:
    words = [
        WordToken(text="and", raw_text="and", start=0.0, end=0.28, probability=0.32),
        WordToken(text="the", raw_text=" the", start=0.28, end=0.56, probability=0.28),
        WordToken(text="thing", raw_text=" thing", start=0.56, end=1.08, probability=0.31),
    ]

    result = segment_words_detailed(words)

    assert result.candidate_count == 1
    assert result.discarded_count == 1
    assert result.clips == []
