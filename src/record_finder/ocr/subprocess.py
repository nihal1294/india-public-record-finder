"""CPython 3.14 adapter for the isolated CPython 3.13 OCR worker."""

import json
import os
import subprocess
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import cast

from PIL import Image
from pydantic import ValidationError

from record_finder.domain.models import FieldName
from record_finder.ocr.base import OCR_SCRIPT, PROTOCOL_VERSION, OCRResult, script_for_field
from record_finder.synthetic.catalog import CATALOG, KarnatakaSyntheticAdapter
from record_finder.synthetic.render import CARD_HEIGHT, GeneratedCorpus, sha256_path


class WorkerProtocolError(RuntimeError):
    """The external worker did not honor the one-request/one-response contract."""


def worker_environment(environment: Mapping[str, str] | None = None) -> dict[str, str]:
    """Remove the root uv environment before launching the CPython 3.13 project."""
    worker_env = dict(os.environ if environment is None else environment)
    worker_env.pop("VIRTUAL_ENV", None)
    return worker_env


@dataclass(frozen=True)
class CropAllowance:
    synthetic_id: str
    field: FieldName
    script: OCR_SCRIPT
    bbox: tuple[int, int, int, int]
    template_id: str
    crop_sha256: str


def build_crop_allowlist(corpus: GeneratedCorpus) -> dict[Path, CropAllowance]:
    """Bind the current renderer output to the only crops the worker may read."""
    adapter = KarnatakaSyntheticAdapter()
    allowed: dict[Path, CropAllowance] = {}
    for record in corpus.records:
        record_id = record.truth.synthetic_id
        for field, path in record.field_crops.items():
            typed_field = cast(FieldName, field)
            allowed[path.resolve()] = CropAllowance(
                synthetic_id=record_id,
                field=typed_field,
                script=script_for_field(typed_field),
                bbox=corpus.field_bboxes[record_id][field],
                template_id=adapter.template_id,
                crop_sha256=sha256_path(path),
            )
    return allowed


def _expected_bbox(synthetic_id: str, field: FieldName) -> tuple[int, int, int, int]:
    adapter = KarnatakaSyntheticAdapter()
    try:
        record_index = next(
            index for index, entry in enumerate(CATALOG) if entry.synthetic_id == synthetic_id
        )
    except StopIteration as error:
        raise WorkerProtocolError("OCR input has an unknown renderer record id") from error
    left, top, right, bottom = adapter.field_geometry[field]
    y_offset = record_index * CARD_HEIGHT
    return (left, top + y_offset, right, bottom + y_offset)


def _validate_allowed_crop(
    image_path: Path, script: OCR_SCRIPT, allowed_crops: Mapping[Path, CropAllowance]
) -> None:
    resolved = image_path.resolve()
    allowance = allowed_crops.get(resolved)
    if allowance is None:
        raise WorkerProtocolError("OCR input is not in the renderer crop allowlist")
    if allowance.field != resolved.stem or allowance.synthetic_id != resolved.parent.name:
        raise WorkerProtocolError("OCR input allowlist identity does not match its path")
    if allowance.script != script or script_for_field(allowance.field) != script:
        raise WorkerProtocolError("OCR input script does not match the renderer field route")
    adapter = KarnatakaSyntheticAdapter()
    if allowance.template_id != adapter.template_id:
        raise WorkerProtocolError("OCR input template does not match the renderer")
    expected_bbox = _expected_bbox(allowance.synthetic_id, allowance.field)
    if allowance.bbox != expected_bbox:
        raise WorkerProtocolError("OCR input bbox does not match the renderer template")
    expected_size = (expected_bbox[2] - expected_bbox[0], expected_bbox[3] - expected_bbox[1])
    with Image.open(resolved) as crop:
        if crop.size != expected_size:
            raise WorkerProtocolError("OCR input does not match renderer field geometry")
    if allowance.crop_sha256 != sha256_path(resolved):
        raise WorkerProtocolError("OCR input does not match renderer crop allowlist digest")


class SubprocessOCRProvider:
    """Run the worker without importing its Paddle dependencies into the app."""

    identity = "paddleocr-subprocess-v1"

    def __init__(
        self,
        allowed_crops: Mapping[Path, CropAllowance],
        command: Sequence[str] = ("uv", "run", "--project", "ocr", "record-finder-ocr"),
        timeout_seconds: float = 30.0,
        max_image_bytes: int = 8 * 1024 * 1024,
    ) -> None:
        self._allowed_crops = dict(allowed_crops)
        self._command = tuple(command)
        self._timeout_seconds = timeout_seconds
        self._max_image_bytes = max_image_bytes

    def recognize(self, image_path: Path, script: OCR_SCRIPT) -> OCRResult:
        if not image_path.is_file():
            raise WorkerProtocolError("OCR crop is missing")
        _validate_allowed_crop(image_path, script, self._allowed_crops)
        if image_path.stat().st_size > self._max_image_bytes:
            raise WorkerProtocolError("OCR crop exceeds bounded request size")
        request = {
            "schema_version": PROTOCOL_VERSION,
            "image_path": str(image_path.resolve()),
            "script": script,
        }
        try:
            completed = subprocess.run(
                self._command,
                input=json.dumps(request, separators=(",", ":")) + "\n",
                capture_output=True,
                check=False,
                encoding="utf-8",
                env=worker_environment(),
                timeout=self._timeout_seconds,
            )
        except subprocess.TimeoutExpired as error:
            raise WorkerProtocolError("OCR worker timed out") from error
        if completed.stderr:
            raise WorkerProtocolError("OCR worker wrote to stderr")
        if completed.returncode != 0:
            raise WorkerProtocolError(f"OCR worker exited {completed.returncode}")
        try:
            payload = json.loads(completed.stdout)
            result = OCRResult.model_validate(payload)
        except (json.JSONDecodeError, ValidationError) as error:
            raise WorkerProtocolError("OCR worker returned an invalid schema") from error
        if result.schema_version != PROTOCOL_VERSION:
            raise WorkerProtocolError("OCR worker returned an unsupported schema version")
        if result.crop_sha256 != sha256_path(image_path):
            raise WorkerProtocolError("OCR worker returned the wrong crop digest")
        return result
