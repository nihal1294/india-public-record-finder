"""Manifest-pinned, local-only E5 embedding support."""

import hashlib
import json
from pathlib import Path
from typing import Any, cast

import numpy as np

MODEL_KEY = "multilingual_e5_small"
MODEL_REPO_ID = "intfloat/multilingual-e5-small"
MODEL_REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
MODEL_DIMENSIONS = 384


class EncoderUnavailable(RuntimeError):
    """The local encoder cannot be used without violating the no-egress boundary."""


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _entry(manifest_path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        entry = cast(dict[str, Any], payload["models"][MODEL_KEY])
    except (OSError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise EncoderUnavailable("local E5 manifest is unavailable") from error
    if (
        entry.get("repo_id") != MODEL_REPO_ID
        or entry.get("revision") != MODEL_REVISION
        or entry.get("license") != "MIT"
        or entry.get("cache_directory") != "multilingual-e5-small"
    ):
        raise EncoderUnavailable("local E5 manifest identity is invalid")
    files = entry.get("files")
    if not isinstance(files, dict) or len(files) != 9:
        raise EncoderUnavailable("local E5 manifest file list is invalid")
    return entry


class LocalE5Encoder:
    """Load exactly one verified E5 directory with runtime network access disabled."""

    model_key = MODEL_KEY
    repo_id = MODEL_REPO_ID
    revision = MODEL_REVISION
    dimensions = MODEL_DIMENSIONS
    available = True

    def __init__(self, model_directory: Path, manifest_path: Path) -> None:
        self._model_directory = model_directory.resolve()
        self._entry = _entry(manifest_path)
        self._model: Any | None = None
        self._verify_local_files()

    def _verify_local_files(self) -> None:
        try:
            for relative, digest in self._entry["files"].items():
                candidate = self._model_directory / relative
                if not candidate.is_file() or _sha256(candidate) != digest:
                    raise EncoderUnavailable("pinned local E5 files are unavailable")
        except OSError as error:
            raise EncoderUnavailable("pinned local E5 files are unavailable") from error

    def _load_model(self) -> Any:
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(str(self._model_directory), local_files_only=True)
            except Exception as error:
                raise EncoderUnavailable("local E5 encoder could not load") from error
        return self._model

    def _encode(self, texts: list[str]) -> np.ndarray:
        try:
            matrix = np.asarray(
                self._load_model().encode(
                    texts,
                    convert_to_numpy=True,
                    normalize_embeddings=True,
                    show_progress_bar=False,
                ),
                dtype=np.float32,
            )
        except EncoderUnavailable:
            raise
        except Exception as error:
            raise EncoderUnavailable("local E5 encoding failed") from error
        if matrix.ndim == 1:
            matrix = matrix.reshape(1, -1)
        if matrix.shape != (len(texts), self.dimensions) or not np.all(np.isfinite(matrix)):
            raise EncoderUnavailable("local E5 encoder returned an invalid vector")
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        if np.any(norms == 0):
            raise EncoderUnavailable("local E5 encoder returned a zero vector")
        return cast(np.ndarray, matrix / norms)

    def encode_records(self, texts: list[str]) -> np.ndarray:
        """Encode offline build passages; callers supply the E5 passage prefix."""
        return self._encode(texts)

    def encode_query(self, text: str) -> np.ndarray:
        """Encode one live query in-process; this never invokes a provider."""
        return cast(np.ndarray, self._encode([f"query: {text}"])[0])
