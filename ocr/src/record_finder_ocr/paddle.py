"""PaddleOCR execution kept entirely in the CPython 3.13 worker."""

import hashlib
import json
import os
import unicodedata
from pathlib import Path
from typing import Literal

MODELS = {
    "kannada": ("PaddlePaddle/ka_PP-OCRv3_mobile_rec", "fd08732bad5fb532cf883cb42a75ed139a72ab18"),
    "latin": ("PaddlePaddle/en_PP-OCRv4_mobile_rec", "f97b62fdc0eb71c689393a19a4b21baa1795c9ab"),
    "numeric": ("PaddlePaddle/en_PP-OCRv4_mobile_rec", "f97b62fdc0eb71c689393a19a4b21baa1795c9ab"),
}

MODEL_FILES = {
    "kannada": {
        "config.json": "ce0b3196ebf47899a2d9466763a394a10e5cb567d1c960d55e2350fbfbc3fa1f",
        "inference.json": "3be0576413bd881ed088dbaf7174c7a32fda9d000fa94cbf687727347fb123cc",
        "inference.pdiparams": "5abb4f1c00e5fab314b06d55f69b137ee79bef3f59b547166a48e93bd530ff12",
        "inference.yml": "948eb2cdc413b7754a3c41e1b4902fbab5478f0bb0f1b9d814f5b08c7bb51765",
    },
    "latin": {
        "config.json": "c1ebffdece1c8eb30515cc3df9bed55c8806fbc57e4231ec7be83f43c57a3660",
        "inference.json": "7a2302e09f0d501458db082cbcf21cdcb3a8d6dc9a143f73b17e297505f922f9",
        "inference.pdiparams": "75f64a1ffb70c56b7a25655963ca16f5bf3286202e3f52ac972bee05cdee2f56",
        "inference.yml": "5f6b19b6b09b6b6f7924de6c25076d0b3528b6f641e64d4f12e6e6207ec33200",
    },
}


def _normalize(value: str) -> str:
    normalized = " ".join(unicodedata.normalize("NFC", value).split()).strip()
    if any("\u0c80" <= char <= "\u0cff" for char in normalized):
        return normalized.replace(" ", "")
    return normalized


def verify_model_cache(model_dir: Path, expected_files: dict[str, str]) -> None:
    """Fail closed unless every pinned worker model file has its declared digest."""
    for filename, expected_digest in expected_files.items():
        path = model_dir / filename
        if not path.is_file():
            raise RuntimeError(f"pinned OCR model cache is missing {filename}")
        actual_digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual_digest != expected_digest:
            raise RuntimeError(f"pinned OCR model cache digest mismatch: {filename}")


def _model_path(script: Literal["kannada", "latin", "numeric"]) -> Path:
    root = os.environ.get("RECORD_FINDER_MODEL_ROOT")
    if root is None:
        raise RuntimeError(
            "RECORD_FINDER_MODEL_ROOT is required; network model fallback is disabled"
        )
    name = "ka_PP-OCRv3_mobile_rec" if script == "kannada" else "en_PP-OCRv4_mobile_rec"
    model_dir = Path(root) / name
    expected_files = MODEL_FILES["kannada" if script == "kannada" else "latin"]
    verify_model_cache(model_dir, expected_files)
    return model_dir


def _extract_text(result: object) -> str:
    if isinstance(result, dict):
        texts = result.get("rec_texts")
        if isinstance(texts, list):
            return " ".join(str(value) for value in texts)
        text = result.get("rec_text")
        if isinstance(text, str):
            return text
        for value in result.values():
            extracted = _extract_text(value)
            if extracted:
                return extracted
    if isinstance(result, list):
        for value in result:
            extracted = _extract_text(value)
            if extracted:
                return extracted
    if hasattr(result, "json"):
        encoded = getattr(result, "json")
        if isinstance(encoded, dict):
            return _extract_text(encoded)
    if hasattr(result, "to_json"):
        encoded = getattr(result, "to_json")()
        if isinstance(encoded, str):
            return _extract_text(json.loads(encoded))
    return ""


def recognize(
    image_path: Path, script: Literal["kannada", "latin", "numeric"]
) -> dict[str, str | int]:
    """Recognize exactly one line crop with a pinned local recognizer."""
    from paddleocr import TextRecognition  # Imported only in the isolated worker.

    model_id, revision = MODELS[script]
    model_dir = _model_path(script)
    configuration = {
        "device": "cpu",
        "model_name": model_dir.name,
        "model_dir": str(model_dir),
        "script": script,
    }
    engine = TextRecognition(
        model_name=model_dir.name,
        model_dir=str(model_dir),
        device="cpu",
    )
    predicted = engine.predict(str(image_path))
    raw_text = _extract_text(predicted)
    return {
        "schema_version": 1,
        "crop_sha256": hashlib.sha256(image_path.read_bytes()).hexdigest(),
        "provider": "paddleocr",
        "model_id": model_id,
        "model_revision": revision,
        "config_sha256": hashlib.sha256(
            json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest(),
        "raw_text": raw_text,
        "normalized_text": _normalize(raw_text),
    }
