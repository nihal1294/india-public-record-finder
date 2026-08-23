"""The query encoder has a hard local-files-only boundary."""

import sys
import types
from pathlib import Path

import numpy as np
import pytest

from record_finder.search import dense


def test_local_e5_loads_sentence_transformers_with_local_files_only(
    tmp_path: Path, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    captured: dict[str, object] = {}

    class _FakeModel:
        def encode(self, texts: list[str], **kwargs: object) -> np.ndarray:
            assert kwargs["normalize_embeddings"] is True
            return np.ones((len(texts), 384), dtype=np.float32)

    def _sentence_transformer(path: str, **kwargs: object) -> _FakeModel:
        captured["path"] = path
        captured.update(kwargs)
        return _FakeModel()

    monkeypatch.setattr(dense, "_entry", lambda _: {"files": {}})
    monkeypatch.setitem(
        sys.modules,
        "sentence_transformers",
        types.SimpleNamespace(SentenceTransformer=_sentence_transformer),
    )

    vector = dense.LocalE5Encoder(tmp_path, tmp_path / "manifest.json").encode_query("Ananya Gowda")

    assert captured["local_files_only"] is True
    assert vector.shape == (384,)
    assert np.linalg.norm(vector) == pytest.approx(1.0)
