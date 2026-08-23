import json
from pathlib import Path

import pytest
from PIL import Image
from typer.testing import CliRunner

from record_finder.cli import app
from record_finder.ocr.base import OCRResult, OCRValidationError, evaluate_ocr
from record_finder.ocr.subprocess import (
    CropAllowance,
    SubprocessOCRProvider,
    WorkerProtocolError,
    build_crop_allowlist,
    worker_environment,
)
from record_finder.synthetic.render import render_spike, sha256_path


class EchoProvider:
    """A deterministic in-memory provider for the report contract."""

    identity = "test-echo"

    def recognize(self, image_path: Path, script: str) -> OCRResult:
        text = image_path.read_text(encoding="utf-8").strip()
        return OCRResult(
            schema_version=1,
            crop_sha256="0" * 64,
            provider="test-echo",
            model_id="test-model",
            model_revision="test-revision",
            config_sha256="1" * 64,
            raw_text=text,
            normalized_text=text,
        )


class WrongValueProvider:
    identity = "test-wrong-value"

    def recognize(self, image_path: Path, script: str) -> OCRResult:
        return OCRResult(
            schema_version=1,
            crop_sha256=sha256_path(image_path),
            provider="test-wrong-value",
            model_id="test-model",
            model_revision="test-revision",
            config_sha256="1" * 64,
            raw_text="not-the-rendered-value",
            normalized_text="not-the-rendered-value",
        )


def test_report_rejects_wrong_record_id(tmp_path: Path) -> None:
    """A provider cannot create a record that the renderer did not account for."""
    corpus = render_spike(tmp_path)
    corpus.records[0].truth.synthetic_id = "SYN-999"

    with pytest.raises(OCRValidationError, match="record id"):
        evaluate_ocr(corpus, EchoProvider())


def test_report_rejects_missing_field_crop(tmp_path: Path) -> None:
    """Every required extraction must be tied to a real renderer crop."""
    corpus = render_spike(tmp_path)
    del corpus.records[0].field_crops["name"]

    with pytest.raises(OCRValidationError, match="missing required field crops"):
        evaluate_ocr(corpus, EchoProvider())


def test_report_rejects_duplicate_ids(tmp_path: Path) -> None:
    """Duplicate canonical IDs make source accounting ambiguous."""
    corpus = render_spike(tmp_path)
    corpus.records[1].truth.synthetic_id = corpus.records[0].truth.synthetic_id

    with pytest.raises(OCRValidationError, match="duplicate"):
        evaluate_ocr(corpus, EchoProvider())


def test_report_rejects_missing_provenance(tmp_path: Path) -> None:
    """An extraction without an on-disk crop fails closed."""
    corpus = render_spike(tmp_path)
    corpus.records[0].field_crops["name"].unlink()

    with pytest.raises(OCRValidationError, match="missing crop"):
        evaluate_ocr(corpus, EchoProvider())


def test_report_records_a_wrong_ocr_identifier_as_a_gate_failure(tmp_path: Path) -> None:
    """OCR content errors are reported with their crop instead of hiding evidence."""
    report = evaluate_ocr(render_spike(tmp_path), WrongValueProvider())

    assert not report.gate_passed
    assert any(mismatch.field == "synthetic_id" for mismatch in report.mismatches)


def test_public_record_does_not_copy_an_unrendered_relationship_from_truth(tmp_path: Path) -> None:
    """Relationship is absent until an OCR extraction can substantiate it."""
    report = evaluate_ocr(render_spike(tmp_path), WrongValueProvider())

    assert all(record.relationship is None for record in report.records)


def test_subprocess_provider_rejects_worker_stderr(tmp_path: Path) -> None:
    """A worker diagnostic can corrupt the single-object stdout protocol."""
    corpus = render_spike(tmp_path)
    crop = corpus.records[0].field_crops["name_latin"]
    provider = SubprocessOCRProvider(
        command=("python", "-c", "import sys; print('diagnostic', file=sys.stderr); print('{}')"),
        allowed_crops=build_crop_allowlist(corpus),
        timeout_seconds=1,
    )

    with pytest.raises(WorkerProtocolError, match="stderr"):
        provider.recognize(crop, "latin")


def test_subprocess_provider_rejects_a_complete_record_evidence_card(tmp_path: Path) -> None:
    """The worker adapter accepts only renderer-owned field or line crops."""
    corpus = render_spike(tmp_path)
    evidence = corpus.records[0].evidence_crop
    provider = SubprocessOCRProvider(
        command=("python", "-c", "print('{}')"), allowed_crops=build_crop_allowlist(corpus)
    )

    with pytest.raises(WorkerProtocolError, match="allowlist"):
        provider.recognize(evidence, "latin")


def test_subprocess_provider_rejects_a_field_crop_with_wrong_geometry(tmp_path: Path) -> None:
    """A field filename alone cannot disguise a crop from a different template."""
    corpus = render_spike(tmp_path)
    crop = corpus.records[0].field_crops["name_latin"]
    Image.new("RGB", (1, 1), "white").save(crop)
    provider = SubprocessOCRProvider(
        command=("python", "-c", "print('{}')"), allowed_crops=build_crop_allowlist(corpus)
    )

    with pytest.raises(WorkerProtocolError, match="geometry"):
        provider.recognize(crop, "latin")


def test_subprocess_provider_rejects_an_unregistered_same_sized_field_crop(tmp_path: Path) -> None:
    """A matching filename and geometry cannot impersonate renderer provenance."""
    forged = tmp_path / "forged" / "field-crops" / "SYN-KA-A" / "name_latin.png"
    forged.parent.mkdir(parents=True)
    Image.new("RGB", (780, 42), "white").save(forged)
    (tmp_path / "forged" / "crop-registry.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "template_id": "karnataka-synthetic-v1",
                "crops": {
                    "field-crops/SYN-KA-A/name_latin.png": {
                        "synthetic_id": "SYN-KA-A",
                        "field": "name_latin",
                        "crop_bbox": [30, 116, 810, 158],
                        "crop_sha256": sha256_path(forged),
                    }
                },
            }
        ),
        encoding="utf-8",
    )
    corpus = render_spike(tmp_path / "corpus")
    provider = SubprocessOCRProvider(
        command=("python", "-c", "print('{}')"), allowed_crops=build_crop_allowlist(corpus)
    )

    with pytest.raises(WorkerProtocolError, match="allowlist"):
        provider.recognize(forged, "latin")


def test_subprocess_provider_rejects_a_valid_crop_with_the_wrong_script(tmp_path: Path) -> None:
    """Recognition routing is part of the renderer-to-worker provenance contract."""
    corpus = render_spike(tmp_path)
    crop = corpus.records[0].field_crops["name_latin"]
    provider = SubprocessOCRProvider(
        command=("python", "-c", "print('{}')"), allowed_crops=build_crop_allowlist(corpus)
    )

    with pytest.raises(WorkerProtocolError, match="script"):
        provider.recognize(crop, "kannada")


def test_subprocess_provider_rejects_an_allowlist_entry_with_a_wrong_bbox(tmp_path: Path) -> None:
    """The adapter independently checks the complete renderer bbox for this template."""
    corpus = render_spike(tmp_path)
    crop = corpus.records[0].field_crops["name_latin"].resolve()
    allowed = build_crop_allowlist(corpus)
    entry = allowed[crop]
    allowed[crop] = CropAllowance(
        synthetic_id=entry.synthetic_id,
        field=entry.field,
        script=entry.script,
        bbox=(entry.bbox[0], entry.bbox[1] + 1, entry.bbox[2], entry.bbox[3]),
        template_id=entry.template_id,
        crop_sha256=entry.crop_sha256,
    )
    provider = SubprocessOCRProvider(command=("python", "-c", "print('{}')"), allowed_crops=allowed)

    with pytest.raises(WorkerProtocolError, match="bbox"):
        provider.recognize(crop, "latin")


def test_root_cli_exposes_named_ocr_spike_command() -> None:
    """The documented offline command must not collapse to the application root."""
    runner = CliRunner()
    root_help = runner.invoke(app, ["--help"])
    result = runner.invoke(app, ["ocr-spike", "--help"])

    assert "ocr-spike" in root_help.output
    assert result.exit_code == 0
    assert "Render and OCR exactly ten" in result.output


def test_worker_environment_does_not_leak_the_root_virtual_environment() -> None:
    """Nested uv must not emit its virtual-environment diagnostic to stderr."""
    environment = worker_environment({"VIRTUAL_ENV": "/root-env", "KEEP": "1"})

    assert "VIRTUAL_ENV" not in environment
    assert environment["KEEP"] == "1"
