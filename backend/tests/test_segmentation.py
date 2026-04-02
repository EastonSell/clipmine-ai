from clipmine_api.pipeline_types import WordToken
from clipmine_api.segmentation import segment_words


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

