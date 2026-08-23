import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[3] / "ocr" / "src"))

from record_finder_ocr.paddle import _extract_text, verify_model_cache


def test_extract_text_reads_the_paddle_text_recognition_result_shape() -> None:
    """PaddleOCR 3.7 TextRecognition nests one line under the `res` envelope."""
    response = [{"res": {"rec_text": "ಅನನ್ಯಾಗೌಡ", "rec_score": 0.99}}]

    assert _extract_text(response) == "ಅನನ್ಯಾಗೌಡ"


def test_worker_rejects_a_cache_file_with_the_wrong_pinned_digest(tmp_path: Path) -> None:
    """A recognizer must verify model identity before reporting it to the app."""
    cache_file = tmp_path / "inference.pdiparams"
    cache_file.write_bytes(b"wrong-model")

    with pytest.raises(RuntimeError, match="digest"):
        verify_model_cache(tmp_path, {"inference.pdiparams": "0" * 64})
