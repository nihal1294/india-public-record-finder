from pathlib import Path

from record_finder.synthetic.render import render_spike


def test_spike_is_deterministic(tmp_path: Path) -> None:
    """Changing renderer output for the fixed catalog must be detectable."""
    first = render_spike(tmp_path / "first")
    second = render_spike(tmp_path / "second")

    assert first.manifest.content_digest == second.manifest.content_digest
    assert first.manifest.record_count == 10
    assert first.manifest.pdf_count == 1


def test_every_core_field_has_a_crop(tmp_path: Path) -> None:
    """A missing OCR crop would leave the record without field provenance."""
    corpus = render_spike(tmp_path)

    assert all(
        {"name", "relative_name", "locality", "age", "synthetic_id"} <= set(record.field_crops)
        for record in corpus.records
    )
