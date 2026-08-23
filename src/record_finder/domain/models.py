"""Canonical, evidence-bound records for the synthetic collection."""

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FieldName = Literal[
    "name",
    "relative_name",
    "locality",
    "house_reference",
    "age",
    "gender",
    "synthetic_id",
    "name_latin",
    "relative_name_latin",
    "relationship",
    "locality_latin",
]


class SourceReference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    snapshot_id: str
    pdf_id: str
    part_number: int
    page_number: int
    record_bbox: tuple[int, int, int, int]
    evidence_id: str
    evidence_sha256: str


class FieldExtraction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: FieldName
    crop_bbox: tuple[int, int, int, int]
    crop_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    provider: str
    model_id: str
    model_revision: str
    config_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    raw_text: str
    normalized_text: str


class FieldProvenance(BaseModel):
    """Declared synthetic source for one canonical demo-record field."""

    model_config = ConfigDict(extra="forbid")

    field: FieldName
    origin: Literal["synthetic_ground_truth"]
    source: SourceReference
    crop_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class RecordFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    synthetic_id: str
    data_classification: Literal["synthetic"] = "synthetic"
    name_native: str
    name_latin: str
    relative_name_native: str
    relative_name_latin: str
    relationship: Literal["father", "mother", "spouse"] | None
    locality_native: str
    locality_latin: str
    house_reference: str
    age: int
    gender: Literal["female", "male", "other"]
    source: SourceReference


class SyntheticTruthRecord(RecordFields):
    """Separate generator truth; it is never handed to an OCR provider."""

    relationship: Literal["father", "mother", "spouse"]


class PublicRecord(RecordFields):
    """A record constructed either from synthetic truth or a bounded OCR experiment."""

    extractions: dict[str, FieldExtraction] = Field(default_factory=dict)
    field_provenance: dict[FieldName, FieldProvenance] = Field(default_factory=dict)


class GeneratedRecord(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, extra="forbid")

    truth: SyntheticTruthRecord
    field_crops: dict[str, Path]
    evidence_crop: Path
