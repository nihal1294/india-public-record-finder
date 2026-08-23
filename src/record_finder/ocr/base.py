"""Versioned OCR contracts and fail-closed feasibility accounting."""

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol, cast

from pydantic import BaseModel, ConfigDict, Field

from record_finder.domain.models import FieldExtraction, FieldName, GeneratedRecord, PublicRecord
from record_finder.synthetic.render import (
    REQUIRED_FIELDS,
    GeneratedCorpus,
    normalize_text,
    sha256_path,
)

OCR_SCRIPT = Literal["kannada", "latin", "numeric"]
PROTOCOL_VERSION = 1


class OCRResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1]
    crop_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    provider: str
    model_id: str
    model_revision: str
    config_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    raw_text: str
    normalized_text: str


class OCRProvider(Protocol):
    @property
    def identity(self) -> str: ...

    def recognize(self, image_path: Path, script: OCR_SCRIPT) -> OCRResult: ...


class OCRValidationError(ValueError):
    """Raised when field or record provenance cannot be proven."""


@dataclass(frozen=True)
class OCRMismatch:
    synthetic_id: str
    field: str
    expected: str
    actual: str
    crop_path: Path


@dataclass
class OCRReport:
    records: list[PublicRecord]
    mismatches: list[OCRMismatch]
    record_count: int
    page_count: int
    semantic_total: int
    semantic_exact: int
    gate_passed: bool

    @property
    def semantic_accuracy(self) -> float:
        return self.semantic_exact / self.semantic_total if self.semantic_total else 0.0


_FIELD_SCRIPTS: dict[FieldName, OCR_SCRIPT] = {
    "synthetic_id": "latin",
    "name": "kannada",
    "name_latin": "latin",
    "relative_name": "kannada",
    "relative_name_latin": "latin",
    "locality": "kannada",
    "locality_latin": "latin",
    "house_reference": "latin",
    "age": "numeric",
    "gender": "latin",
}


def script_for_field(field: FieldName) -> OCR_SCRIPT:
    """Return the sole pinned recognizer route for a rendered field crop."""
    return _FIELD_SCRIPTS[field]


def _validate_corpus(corpus: GeneratedCorpus) -> None:
    ids = [record.truth.synthetic_id for record in corpus.records]
    if len(ids) != len(set(ids)):
        raise OCRValidationError("duplicate synthetic record id")
    if len(corpus.records) != corpus.manifest.record_count:
        raise OCRValidationError("record id accounting does not match manifest")
    for record in corpus.records:
        if record.truth.synthetic_id not in corpus.field_bboxes:
            raise OCRValidationError("record id is not present in renderer geometry")
        if not REQUIRED_FIELDS <= set(record.field_crops):
            raise OCRValidationError("missing required field crops")
        if not record.evidence_crop.is_file():
            raise OCRValidationError("missing crop provenance for evidence")
        for field, path in record.field_crops.items():
            if field not in _FIELD_SCRIPTS:
                raise OCRValidationError(f"unknown field crop: {field}")
            if not path.is_file():
                raise OCRValidationError(f"missing crop provenance for {field}")
        source = record.truth.source
        if source.evidence_sha256 != sha256_path(record.evidence_crop):
            raise OCRValidationError("missing crop provenance digest")


def _truth_value(record: GeneratedRecord, field: FieldName) -> str:
    truth = record.truth
    values = {
        "synthetic_id": truth.synthetic_id,
        "name": truth.name_native,
        "name_latin": truth.name_latin,
        "relative_name": truth.relative_name_native,
        "relative_name_latin": truth.relative_name_latin,
        "locality": truth.locality_native,
        "locality_latin": truth.locality_latin,
        "house_reference": truth.house_reference,
        "age": str(truth.age),
        "gender": truth.gender,
    }
    return values[field]


def _public_record(
    record: GeneratedRecord, values: dict[str, str], extractions: dict[str, FieldExtraction]
) -> PublicRecord:
    return PublicRecord(
        synthetic_id=values["synthetic_id"],
        name_native=values["name"],
        name_latin=values["name_latin"],
        relative_name_native=values["relative_name"],
        relative_name_latin=values["relative_name_latin"],
        relationship=None,
        locality_native=values["locality"],
        locality_latin=values["locality_latin"],
        house_reference=values["house_reference"],
        age=int(values["age"]) if values["age"].isdigit() else -1,
        gender=cast(
            Literal["female", "male", "other"],
            values["gender"] if values["gender"] in {"female", "male", "other"} else "other",
        ),
        source=record.truth.source,
        extractions=extractions,
    )


def evaluate_ocr(corpus: GeneratedCorpus, provider: OCRProvider) -> OCRReport:
    """Run the provider only on crops and compare its output with separate truth."""
    _validate_corpus(corpus)
    mismatches: list[OCRMismatch] = []
    records: list[PublicRecord] = []
    semantic_total = 0
    semantic_exact = 0
    for generated in corpus.records:
        values: dict[str, str] = {}
        extractions: dict[str, FieldExtraction] = {}
        for field, path in generated.field_crops.items():
            typed_field = cast(FieldName, field)
            result = provider.recognize(path, _FIELD_SCRIPTS[typed_field])
            crop_digest = sha256_path(path)
            if result.schema_version != PROTOCOL_VERSION or result.crop_sha256 != crop_digest:
                raise OCRValidationError(f"invalid OCR provenance for {field}")
            value = normalize_text(result.normalized_text)
            expected = normalize_text(_truth_value(generated, typed_field))
            values[field] = value
            extractions[field] = FieldExtraction(
                field=typed_field,
                crop_bbox=corpus.field_bboxes[generated.truth.synthetic_id][field],
                crop_sha256=crop_digest,
                provider=result.provider,
                model_id=result.model_id,
                model_revision=result.model_revision,
                config_sha256=result.config_sha256,
                raw_text=result.raw_text,
                normalized_text=value,
            )
            if value != expected:
                mismatches.append(
                    OCRMismatch(generated.truth.synthetic_id, field, expected, value, path)
                )
            if field in {"name", "relative_name", "locality"}:
                semantic_total += 1
                semantic_exact += int(value == expected)
        records.append(_public_record(generated, values, extractions))
    ids = [record.synthetic_id for record in records]
    expected_ids = [record.truth.synthetic_id for record in corpus.records]
    required_exact = {"synthetic_id", "age", "house_reference"}
    gate_passed = (
        len(records) == 10
        and corpus.manifest.pdf_count == 1
        and ids == expected_ids
        and len(ids) == len(set(ids))
        and semantic_total == 30
        and semantic_exact / semantic_total >= 0.90
        and not any(m.field in required_exact for m in mismatches)
    )
    return OCRReport(
        records,
        mismatches,
        len(records),
        corpus.manifest.pdf_count,
        semantic_total,
        semantic_exact,
        gate_passed,
    )
