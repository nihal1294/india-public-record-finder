import os
from pathlib import Path

import pytest

from record_finder.ocr.base import evaluate_ocr
from record_finder.ocr.subprocess import SubprocessOCRProvider, build_crop_allowlist
from record_finder.synthetic.render import render_spike


@pytest.mark.skipif(
    "RECORD_FINDER_MODEL_ROOT" not in os.environ,
    reason="the pinned external OCR model cache is required for the real spike",
)
def test_pinned_paddle_worker_returns_complete_crop_provenance(tmp_path: Path) -> None:
    corpus = render_spike(tmp_path)
    report = evaluate_ocr(
        corpus,
        SubprocessOCRProvider(allowed_crops=build_crop_allowlist(corpus), timeout_seconds=120.0),
    )

    assert report.record_count == 10
    assert report.page_count == 1
    assert report.semantic_total == 30
    assert all(record.relationship is None for record in report.records)
    assert all("name" in record.extractions for record in report.records)
    assert not report.gate_passed
