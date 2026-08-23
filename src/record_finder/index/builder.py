"""Publish a verified snapshot from deterministic fictional ground truth only."""

import json
import shutil
import sqlite3
import tempfile
from pathlib import Path
from typing import Protocol

import numpy as np

from record_finder.domain.models import FieldName, FieldProvenance
from record_finder.index.manifest import (
    REQUIRED_DEMO_EXAMPLES,
    DenseIndexManifest,
    SnapshotIntegrityError,
    SnapshotManifest,
    validate_evidence_id,
    verify_snapshot,
)
from record_finder.synthetic.render import GeneratedCorpus, sha256_path


class DenseEncoder(Protocol):
    """Offline-only record encoder used during snapshot publication."""

    model_key: str
    repo_id: str
    revision: str
    dimensions: int

    def encode_records(self, texts: list[str]) -> np.ndarray: ...


_PROVENANCE_FIELDS: tuple[FieldName, ...] = (
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
)


def _field_provenance(corpus: GeneratedCorpus, record_index: int) -> dict[str, dict[str, object]]:
    generated = corpus.records[record_index]
    source = generated.truth.source
    return {
        field: FieldProvenance(
            field=field,
            origin="synthetic_ground_truth",
            source=source,
            crop_sha256=source.evidence_sha256,
        ).model_dump(mode="json")
        for field in _PROVENANCE_FIELDS
    }


def _create_database(corpus: GeneratedCorpus, database_path: Path) -> None:
    connection = sqlite3.connect(database_path)
    try:
        connection.executescript(
            """
            CREATE TABLE records (
                position INTEGER PRIMARY KEY,
                synthetic_id TEXT NOT NULL UNIQUE,
                record_origin TEXT NOT NULL,
                name_native TEXT NOT NULL,
                name_latin TEXT NOT NULL,
                relative_name_native TEXT NOT NULL,
                relative_name_latin TEXT NOT NULL,
                relationship TEXT NOT NULL,
                locality_native TEXT NOT NULL,
                locality_latin TEXT NOT NULL,
                house_reference TEXT NOT NULL,
                age INTEGER NOT NULL,
                gender TEXT NOT NULL,
                source_json TEXT NOT NULL,
                field_provenance TEXT NOT NULL
            );
            CREATE VIRTUAL TABLE records_fts USING fts5(
                name_native, name_latin, relative_name_native, relative_name_latin, locality_native,
                locality_latin, content='records', content_rowid='position'
            );
            """
        )
        for position, generated in enumerate(corpus.records):
            truth = generated.truth
            connection.execute(
                """
                INSERT INTO records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    position,
                    truth.synthetic_id,
                    "synthetic_ground_truth",
                    truth.name_native,
                    truth.name_latin,
                    truth.relative_name_native,
                    truth.relative_name_latin,
                    truth.relationship,
                    truth.locality_native,
                    truth.locality_latin,
                    truth.house_reference,
                    truth.age,
                    truth.gender,
                    json.dumps(
                        truth.source.model_dump(mode="json"), ensure_ascii=False, sort_keys=True
                    ),
                    json.dumps(
                        _field_provenance(corpus, position), ensure_ascii=False, sort_keys=True
                    ),
                ),
            )
            connection.execute(
                """
                INSERT INTO records_fts(
                    rowid, name_native, name_latin, relative_name_native, relative_name_latin,
                    locality_native, locality_latin
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    position,
                    truth.name_native,
                    truth.name_latin,
                    truth.relative_name_native,
                    truth.relative_name_latin,
                    truth.locality_native,
                    truth.locality_latin,
                ),
            )
        connection.commit()
    finally:
        connection.close()


def _validate_corpus(corpus: GeneratedCorpus) -> None:
    if (
        corpus.manifest.record_count != 120
        or corpus.manifest.pdf_count != 3
        or corpus.manifest.page_count != 12
    ):
        raise SnapshotIntegrityError("demo source accounting must be 120 records and three PDFs")
    if len(corpus.records) != 120 or len(corpus.manifest.pdf_paths) != 3:
        raise SnapshotIntegrityError("demo source artifacts are incomplete")
    for generated in corpus.records:
        source = generated.truth.source
        validate_evidence_id(source.evidence_id)
        if source.evidence_id != f"evidence-{generated.truth.synthetic_id}":
            raise SnapshotIntegrityError("source evidence identifier binding failed")
        if (
            not generated.evidence_crop.is_file()
            or sha256_path(generated.evidence_crop) != source.evidence_sha256
        ):
            raise SnapshotIntegrityError("source evidence digest mismatch")


def _record_embedding_text(corpus: GeneratedCorpus, position: int) -> str:
    truth = corpus.records[position].truth
    return (
        f"passage: {truth.name_native} {truth.name_latin}; "
        f"{truth.relative_name_native} {truth.relative_name_latin}; "
        f"{truth.locality_native} {truth.locality_latin}; age {truth.age}"
    )


def _write_dense_index(
    corpus: GeneratedCorpus, destination: Path, encoder: DenseEncoder
) -> DenseIndexManifest:
    texts = [_record_embedding_text(corpus, index) for index in range(len(corpus.records))]
    matrix = np.asarray(encoder.encode_records(texts), dtype=np.float32)
    if matrix.shape != (len(corpus.records), encoder.dimensions) or encoder.dimensions != 384:
        raise SnapshotIntegrityError("dense encoder returned an unexpected matrix shape")
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    if not np.all(np.isfinite(matrix)) or np.any(norms == 0):
        raise SnapshotIntegrityError("dense encoder returned an invalid matrix")
    normalized = matrix / norms
    matrix_path = destination / "embeddings.npy"
    np.save(matrix_path, normalized.astype(np.float32, copy=False), allow_pickle=False)
    return DenseIndexManifest.model_validate(
        {
            "model_key": encoder.model_key,
            "repo_id": encoder.repo_id,
            "revision": encoder.revision,
            "dimensions": encoder.dimensions,
            "matrix_sha256": sha256_path(matrix_path),
        }
    )


def _write_snapshot(
    corpus: GeneratedCorpus, destination: Path, dense_encoder: DenseEncoder | None
) -> SnapshotManifest:
    evidence_root = destination / "evidence"
    pdf_root = destination / "pdfs"
    evidence_root.mkdir(parents=True)
    pdf_root.mkdir()
    evidence: dict[str, str] = {}
    for generated in corpus.records:
        source = generated.truth.source
        validate_evidence_id(source.evidence_id)
        evidence_path = evidence_root / f"{source.evidence_id}.png"
        shutil.copyfile(generated.evidence_crop, evidence_path)
        evidence[source.evidence_id] = sha256_path(evidence_path)
    pdfs: dict[str, str] = {}
    for source_pdf in corpus.manifest.pdf_paths:
        if not source_pdf.is_file():
            raise SnapshotIntegrityError("source PDF is missing")
        destination_pdf = pdf_root / source_pdf.name
        shutil.copyfile(source_pdf, destination_pdf)
        pdfs[source_pdf.name] = sha256_path(destination_pdf)
    database_path = destination / "records.sqlite3"
    _create_database(corpus, database_path)
    dense_index = (
        _write_dense_index(corpus, destination, dense_encoder)
        if dense_encoder is not None
        else None
    )
    manifest = SnapshotManifest(
        record_count=len(corpus.records),
        pdf_count=len(pdfs),
        page_count=corpus.manifest.page_count,
        records_db_sha256=sha256_path(database_path),
        evidence=evidence,
        pdfs=pdfs,
        record_ids=tuple(record.truth.synthetic_id for record in corpus.records),
        demo_examples=REQUIRED_DEMO_EXAMPLES,
        dense_index=dense_index,
    )
    manifest_path = destination / "manifest.json"
    manifest_path.write_text(manifest.model_dump_json(indent=2) + "\n", encoding="utf-8")
    return verify_snapshot(manifest_path)


def build_demo_snapshot(
    corpus: GeneratedCorpus, destination: Path, dense_encoder: DenseEncoder | None = None
) -> SnapshotManifest:
    """Publish only a validated synthetic-ground-truth snapshot."""
    _validate_corpus(corpus)
    if destination.exists():
        raise FileExistsError(f"snapshot destination already exists: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=f".{destination.name}.stage-", dir=destination.parent))
    try:
        manifest = _write_snapshot(corpus, stage, dense_encoder)
        stage.replace(destination)
        return manifest
    finally:
        if stage.exists():
            shutil.rmtree(stage)
