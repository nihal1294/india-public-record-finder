"""Schema and verifier for an immutable synthetic demo snapshot."""

import json
import math
import re
import sqlite3
from pathlib import Path
from typing import Literal

import numpy as np
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pypdfium2 import PdfDocument  # type: ignore[import-untyped]

from record_finder.domain.models import FieldProvenance, SourceReference
from record_finder.integrity import sha256_path


class SnapshotIntegrityError(ValueError):
    """Raised when a snapshot cannot prove its declared synthetic contents."""


class DemoExample(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    label: str
    query: dict[str, str | int]
    refinement: dict[str, str | int] | None = None
    expected_state: Literal["possible_match", "needs_more_detail", "no_confident_result"]
    expected_refined_state: Literal["possible_match"] | None = None
    expected_record_id: str | None = None


class DenseIndexManifest(BaseModel):
    """The immutable local embedding artifact bound to a snapshot."""

    model_config = ConfigDict(extra="forbid")

    model_key: Literal["multilingual_e5_small"]
    repo_id: Literal["intfloat/multilingual-e5-small"]
    revision: Literal["614241f622f53c4eeff9890bdc4f31cfecc418b3"]
    dimensions: Literal[384]
    matrix_path: Literal["embeddings.npy"] = "embeddings.npy"
    matrix_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class SnapshotManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1] = 1
    data_classification: Literal["synthetic"] = "synthetic"
    record_origin: Literal["synthetic_ground_truth"] = "synthetic_ground_truth"
    record_count: int = Field(ge=1)
    pdf_count: int = Field(ge=1)
    page_count: int = Field(ge=1)
    records_db_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    evidence: dict[str, str]
    pdfs: dict[str, str]
    record_ids: tuple[str, ...]
    demo_examples: tuple[DemoExample, ...]
    dense_index: DenseIndexManifest | None = None


REQUIRED_DEMO_EXAMPLES = (
    DemoExample(
        id="exact-kannada",
        label="Exact Kannada",
        query={"name": "ಅನನ್ಯಾ ಗೌಡ", "relative_name": "ರಮೇಶ್ ಗೌಡ", "locality": "ಚೆನ್ನಾಪುರ", "age": 28},
        expected_state="possible_match",
        expected_record_id="SYN-KA-A",
    ),
    DemoExample(
        id="romanized-typo",
        label="Romanized typo",
        query={
            "name": "Ananya Gowdaa",
            "relative_name": "Ramesh Gowda",
            "locality": "Chennapura",
            "age": 28,
        },
        expected_state="possible_match",
        expected_record_id="SYN-KA-A",
    ),
    DemoExample(
        id="needs-refinement",
        label="Needs refinement",
        query={"name": "Kavya Nayak"},
        refinement={"relative_name": "Sunil Nayak", "locality": "Beluru", "age": 31},
        expected_state="needs_more_detail",
        expected_refined_state="possible_match",
        expected_record_id="SYN-KA-C",
    ),
    DemoExample(
        id="no-confident-match",
        label="No confident match",
        query={"name": "Nandini Meridian", "locality": "Imaginary Nagar"},
        expected_state="no_confident_result",
    ),
)

_REQUIRED_FIELDS = frozenset(
    {
        "synthetic_id",
        "name",
        "name_latin",
        "relative_name",
        "relative_name_latin",
        "relationship",
        "locality",
        "locality_latin",
        "house_reference",
        "age",
        "gender",
    }
)
_EVIDENCE_ID = re.compile(r"evidence-SYN-KA-(?:[A-K]|[0-9]{3})$")
_ROOT_ENTRIES = frozenset({"manifest.json", "records.sqlite3", "evidence", "pdfs"})
_RECORD_SCHEMA = (
    ("position", "INTEGER", 0, 1),
    ("synthetic_id", "TEXT", 1, 0),
    ("record_origin", "TEXT", 1, 0),
    ("name_native", "TEXT", 1, 0),
    ("name_latin", "TEXT", 1, 0),
    ("relative_name_native", "TEXT", 1, 0),
    ("relative_name_latin", "TEXT", 1, 0),
    ("relationship", "TEXT", 1, 0),
    ("locality_native", "TEXT", 1, 0),
    ("locality_latin", "TEXT", 1, 0),
    ("house_reference", "TEXT", 1, 0),
    ("age", "INTEGER", 1, 0),
    ("gender", "TEXT", 1, 0),
    ("source_json", "TEXT", 1, 0),
    ("field_provenance", "TEXT", 1, 0),
)
_FTS_COLUMNS = (
    "name_native",
    "name_latin",
    "relative_name_native",
    "relative_name_latin",
    "locality_native",
    "locality_latin",
)
_FTS_SCHEMA = (
    "createvirtualtablerecords_ftsusingfts5("
    "name_native,name_latin,relative_name_native,relative_name_latin,locality_native,"
    "locality_latin,content='records',content_rowid='position')"
)
_FTS_RECORD_COLUMNS = (
    "position",
    "name_native",
    "name_latin",
    "relative_name_native",
    "relative_name_latin",
    "locality_native",
    "locality_latin",
)


def _safe_name(value: str, category: str) -> None:
    if not value or Path(value).name != value or value in {".", ".."}:
        raise SnapshotIntegrityError(f"invalid {category} name")


def validate_evidence_id(value: str) -> None:
    """Reject an evidence identifier before it can become a filesystem path."""
    _safe_name(value, "evidence")
    if not _EVIDENCE_ID.fullmatch(value):
        raise SnapshotIntegrityError("invalid evidence identifier")


def _read_manifest(manifest_path: Path) -> SnapshotManifest:
    try:
        return SnapshotManifest.model_validate_json(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValidationError, json.JSONDecodeError) as error:
        raise SnapshotIntegrityError("invalid snapshot manifest") from error


def _validate_declared_files(root: Path, directory: str, expected: set[str]) -> None:
    directory_path = root / directory
    if not directory_path.is_dir():
        raise SnapshotIntegrityError(f"missing {directory} directory")
    actual = {path.name for path in directory_path.iterdir() if path.is_file()}
    if actual != expected or any(path.is_dir() for path in directory_path.iterdir()):
        raise SnapshotIntegrityError(f"undeclared {directory} artifact")


def _validate_root_inventory(root: Path, manifest: SnapshotManifest) -> None:
    expected = _ROOT_ENTRIES | ({"embeddings.npy"} if manifest.dense_index is not None else set())
    if {path.name for path in root.iterdir()} != expected:
        raise SnapshotIntegrityError("undeclared snapshot root artifact")


def _validate_dense_index(root: Path, manifest: SnapshotManifest) -> None:
    dense = manifest.dense_index
    if dense is None:
        return
    matrix_path = root / dense.matrix_path
    if not matrix_path.is_file() or sha256_path(matrix_path) != dense.matrix_sha256:
        raise SnapshotIntegrityError("dense matrix digest verification failed")
    try:
        matrix = np.load(matrix_path, mmap_mode="r", allow_pickle=False)
    except (OSError, ValueError) as error:
        raise SnapshotIntegrityError("dense matrix cannot be loaded") from error
    expected_shape = (manifest.record_count, dense.dimensions)
    if matrix.dtype != np.dtype(np.float32) or matrix.shape != expected_shape:
        raise SnapshotIntegrityError("dense matrix shape verification failed")
    norms = np.linalg.norm(matrix, axis=1)
    valid_norms = all(math.isclose(float(norm), 1.0, abs_tol=1e-4) for norm in norms)
    if not np.all(np.isfinite(matrix)) or not valid_norms:
        raise SnapshotIntegrityError("dense matrix normalization verification failed")


def _validate_database_schema(connection: sqlite3.Connection) -> None:
    record_columns = tuple(
        (row[1], row[2], row[3], row[5]) for row in connection.execute("PRAGMA table_info(records)")
    )
    if record_columns != _RECORD_SCHEMA:
        raise SnapshotIntegrityError("records schema verification failed")
    fts_columns = tuple(row[1] for row in connection.execute("PRAGMA table_info(records_fts)"))
    fts_schema = connection.execute(
        "SELECT sql FROM sqlite_master WHERE name = 'records_fts'"
    ).fetchone()
    if (
        fts_columns != _FTS_COLUMNS
        or fts_schema is None
        or re.sub(r"\s+", "", fts_schema[0]).casefold() != _FTS_SCHEMA
    ):
        raise SnapshotIntegrityError("FTS schema verification failed")


def _fts_instances(
    connection: sqlite3.Connection, table_name: str, vocabulary_name: str
) -> tuple[tuple[object, ...], ...]:
    connection.execute(
        f"CREATE VIRTUAL TABLE {vocabulary_name} USING fts5vocab({table_name}, 'instance')"
    )
    return tuple(
        connection.execute(
            f"SELECT term, doc, col, offset FROM {vocabulary_name} ORDER BY term, doc, col, offset"
        )
    )


def _validate_fts_content(connection: sqlite3.Connection) -> None:
    """Compare the persisted FTS instances with a separately rebuilt in-memory index."""
    actual = sqlite3.connect(":memory:")
    expected = sqlite3.connect(":memory:")
    try:
        connection.backup(actual)
        records = tuple(
            connection.execute(
                "SELECT position, name_native, name_latin, relative_name_native, "
                "relative_name_latin, locality_native, locality_latin "
                "FROM records ORDER BY position"
            )
        )
        actual_instances = _fts_instances(actual, "records_fts", "actual_vocabulary")
        expected.execute(
            "CREATE VIRTUAL TABLE expected_fts USING fts5("
            "name_native, name_latin, relative_name_native, relative_name_latin, "
            "locality_native, locality_latin)"
        )
        expected.executemany(
            "INSERT INTO expected_fts("
            "rowid, name_native, name_latin, relative_name_native, relative_name_latin, "
            "locality_native, locality_latin) VALUES (?, ?, ?, ?, ?, ?, ?)",
            records,
        )
        expected_instances = _fts_instances(expected, "expected_fts", "expected_vocabulary")
    except sqlite3.Error as error:
        raise SnapshotIntegrityError("FTS content verification failed") from error
    finally:
        actual.close()
        expected.close()
    if actual_instances != expected_instances:
        raise SnapshotIntegrityError("FTS content verification failed")


def _validate_pdf_evidence_pixels(root: Path, sources: tuple[SourceReference, ...]) -> None:
    """Render one page at a time and bind every evidence PNG to its declared card."""
    active_pdf_id: str | None = None
    document: PdfDocument | None = None
    active_page_number: int | None = None
    rendered_page: Image.Image | None = None
    try:
        for source in sources:
            if source.pdf_id != active_pdf_id:
                if document is not None:
                    document.close()
                document = PdfDocument(root / "pdfs" / source.pdf_id)
                active_pdf_id = source.pdf_id
                active_page_number = None
                rendered_page = None
            if source.page_number != active_page_number:
                assert document is not None
                bitmap = document[source.page_number - 1].render(scale=1)
                try:
                    rendered_page = bitmap.to_pil().convert("RGB")
                finally:
                    bitmap.close()
                active_page_number = source.page_number
            evidence_path = root / "evidence" / f"{source.evidence_id}.png"
            with Image.open(evidence_path) as evidence:
                evidence_rgb = evidence.convert("RGB")
                assert rendered_page is not None
                if rendered_page.crop(source.record_bbox).tobytes() != evidence_rgb.tobytes():
                    raise SnapshotIntegrityError("evidence PDF pixel binding failed")
    except (OSError, RuntimeError) as error:
        raise SnapshotIntegrityError("evidence PDF pixel binding failed") from error
    finally:
        if document is not None:
            document.close()


def _validate_source_binding(
    synthetic_id: str,
    position: int,
    source_payload: str,
    provenance_payload: str,
    manifest: SnapshotManifest,
    pdf_pages: dict[str, int],
    evidence_path: Path,
) -> SourceReference:
    try:
        source = SourceReference.model_validate_json(source_payload)
        provenance_raw = json.loads(provenance_payload)
    except (ValidationError, json.JSONDecodeError) as error:
        raise SnapshotIntegrityError("source provenance is invalid") from error
    if source.snapshot_id != "synthetic-karnataka-demo-v1":
        raise SnapshotIntegrityError("source snapshot identifier binding failed")
    if source.evidence_id != f"evidence-{synthetic_id}":
        raise SnapshotIntegrityError("source evidence identifier binding failed")
    validate_evidence_id(source.evidence_id)
    if manifest.evidence.get(source.evidence_id) != source.evidence_sha256:
        raise SnapshotIntegrityError("source evidence digest binding failed")
    expected_page = position // 10
    expected_pdf_number = expected_page // 4 + 1
    expected_page_number = expected_page % 4 + 1
    expected_bbox = (0, (position % 10) * 430, 900, ((position % 10) + 1) * 430)
    if (
        source.pdf_id != f"synthetic-karnataka-demo-{expected_pdf_number}.pdf"
        or source.part_number != expected_pdf_number
        or source.page_number != expected_page_number
        or source.record_bbox != expected_bbox
        or source.pdf_id not in manifest.pdfs
        or source.pdf_id not in pdf_pages
    ):
        raise SnapshotIntegrityError("source renderer geometry binding failed")
    try:
        with Image.open(evidence_path) as image:
            if image.size != (900, 430):
                raise SnapshotIntegrityError("evidence renderer geometry binding failed")
    except OSError as error:
        raise SnapshotIntegrityError("evidence renderer geometry binding failed") from error
    if not isinstance(provenance_raw, dict) or set(provenance_raw) != _REQUIRED_FIELDS:
        raise SnapshotIntegrityError("field provenance field-set failed")
    for field, field_payload in provenance_raw.items():
        try:
            provenance = FieldProvenance.model_validate_json(json.dumps(field_payload))
        except (TypeError, ValidationError) as error:
            raise SnapshotIntegrityError("field provenance is invalid") from error
        if provenance.field != field or provenance.source != source:
            raise SnapshotIntegrityError("field provenance source binding failed")
        if provenance.crop_sha256 != source.evidence_sha256:
            raise SnapshotIntegrityError("field provenance evidence binding failed")
    return source


def verify_snapshot(manifest_path: Path) -> SnapshotManifest:
    """Fail closed unless every declared synthetic artifact and row is intact."""
    manifest = _read_manifest(manifest_path)
    root = manifest_path.parent.resolve()
    _validate_root_inventory(root, manifest)
    if manifest.record_count != 120 or manifest.pdf_count != 3 or manifest.page_count != 12:
        raise SnapshotIntegrityError("snapshot record, PDF, or page count requirement failed")
    if manifest.record_count != len(manifest.record_ids) or len(set(manifest.record_ids)) != len(
        manifest.record_ids
    ):
        raise SnapshotIntegrityError("record identifier accounting failed")
    if manifest.pdf_count != len(manifest.pdfs) or len(manifest.evidence) != manifest.record_count:
        raise SnapshotIntegrityError("artifact accounting failed")
    _validate_dense_index(root, manifest)
    if manifest.demo_examples != REQUIRED_DEMO_EXAMPLES:
        raise SnapshotIntegrityError("demo example binding failed")
    if any(
        example.expected_record_id is not None
        and example.expected_record_id not in manifest.record_ids
        for example in manifest.demo_examples
    ):
        raise SnapshotIntegrityError("demo example record binding failed")
    _validate_declared_files(
        root, "evidence", {f"{evidence_id}.png" for evidence_id in manifest.evidence}
    )
    _validate_declared_files(root, "pdfs", set(manifest.pdfs))
    for evidence_id, digest in manifest.evidence.items():
        validate_evidence_id(evidence_id)
        evidence_path = root / "evidence" / f"{evidence_id}.png"
        if not evidence_path.is_file() or sha256_path(evidence_path) != digest:
            raise SnapshotIntegrityError("evidence digest verification failed")
    pdf_pages: dict[str, int] = {}
    for pdf_name, digest in manifest.pdfs.items():
        _safe_name(pdf_name, "PDF")
        pdf_path = root / "pdfs" / pdf_name
        if not pdf_path.is_file() or sha256_path(pdf_path) != digest:
            raise SnapshotIntegrityError("PDF digest verification failed")
        try:
            pdf_pages[pdf_name] = len(PdfDocument(pdf_path))
        except Exception as error:
            raise SnapshotIntegrityError("PDF page verification failed") from error
    if sum(pdf_pages.values()) != manifest.page_count or set(pdf_pages.values()) != {4}:
        raise SnapshotIntegrityError("PDF page accounting failed")
    database_path = root / "records.sqlite3"
    if not database_path.is_file() or sha256_path(database_path) != manifest.records_db_sha256:
        raise SnapshotIntegrityError("database digest verification failed")
    try:
        connection = sqlite3.connect(f"file:{database_path}?mode=ro", uri=True)
        _validate_database_schema(connection)
        _validate_fts_content(connection)
        rows = connection.execute(
            "SELECT position, synthetic_id, record_origin, source_json, field_provenance "
            "FROM records ORDER BY position"
        ).fetchall()
    except sqlite3.Error as error:
        raise SnapshotIntegrityError("database validation failed") from error
    finally:
        if "connection" in locals():
            connection.close()
    if tuple(row[1] for row in rows) != manifest.record_ids:
        raise SnapshotIntegrityError("database record identifiers failed")
    sources: list[SourceReference] = []
    for position, synthetic_id, origin, source_payload, provenance_payload in rows:
        if origin != "synthetic_ground_truth":
            raise SnapshotIntegrityError("database record origin failed")
        sources.append(
            _validate_source_binding(
                synthetic_id,
                position,
                source_payload,
                provenance_payload,
                manifest,
                pdf_pages,
                root / "evidence" / f"evidence-{synthetic_id}.png",
            )
        )
    _validate_pdf_evidence_pixels(root, tuple(sources))
    return manifest
