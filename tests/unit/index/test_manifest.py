import json
import sqlite3
from pathlib import Path

import pytest
from PIL import Image

from record_finder.index import builder
from record_finder.index.builder import build_demo_snapshot
from record_finder.index.manifest import SnapshotIntegrityError, verify_snapshot
from record_finder.synthetic.render import render_demo_source, sha256_path


def _rewrite_manifest(manifest_path: Path, payload: dict[str, object]) -> None:
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")


def _refresh_database_digest(destination: Path) -> None:
    manifest_path = destination / "manifest.json"
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["records_db_sha256"] = sha256_path(destination / "records.sqlite3")
    _rewrite_manifest(manifest_path, payload)


def _replace_record_source_evidence_digest(
    connection: sqlite3.Connection, synthetic_id: str, digest: str
) -> None:
    source = json.loads(
        connection.execute(
            "SELECT source_json FROM records WHERE synthetic_id = ?", (synthetic_id,)
        ).fetchone()[0]
    )
    source["evidence_sha256"] = digest
    provenance = json.loads(
        connection.execute(
            "SELECT field_provenance FROM records WHERE synthetic_id = ?", (synthetic_id,)
        ).fetchone()[0]
    )
    for field in provenance.values():
        field["source"]["evidence_sha256"] = digest
        field["crop_sha256"] = digest
    connection.execute(
        "UPDATE records SET source_json = ?, field_provenance = ? WHERE synthetic_id = ?",
        (json.dumps(source), json.dumps(provenance), synthetic_id),
    )


def test_demo_snapshot_contains_120_ground_truth_records(tmp_path: Path) -> None:
    manifest = build_demo_snapshot(render_demo_source(tmp_path / "source"), tmp_path / "snapshot")

    assert manifest.record_count == 120
    assert manifest.pdf_count == 3
    assert manifest.page_count == 12
    assert manifest.record_origin == "synthetic_ground_truth"
    assert len(manifest.evidence) == 120
    assert len(manifest.demo_examples) == 4


def test_snapshot_rejects_an_ocr_origin_or_missing_evidence(tmp_path: Path) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    manifest_path = destination / "manifest.json"
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["record_origin"] = "ocr"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(SnapshotIntegrityError):
        verify_snapshot(manifest_path)


def test_snapshot_rejects_a_missing_evidence_file(tmp_path: Path) -> None:
    destination = tmp_path / "snapshot"
    manifest = build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    evidence_id = next(iter(manifest.evidence))
    (destination / "evidence" / f"{evidence_id}.png").unlink()

    with pytest.raises(SnapshotIntegrityError, match="evidence"):
        verify_snapshot(destination / "manifest.json")


def test_snapshot_rejects_an_undeclared_artifact(tmp_path: Path) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    (destination / "evidence" / "undeclared.png").write_bytes(b"not evidence")

    with pytest.raises(SnapshotIntegrityError, match="undeclared"):
        verify_snapshot(destination / "manifest.json")


@pytest.mark.parametrize("extra_name", ["ocr-report.json", "unexpected"])
def test_snapshot_rejects_any_undeclared_root_entry(tmp_path: Path, extra_name: str) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    extra_path = destination / extra_name
    if extra_path.suffix:
        extra_path.write_text("not part of the immutable snapshot", encoding="utf-8")
    else:
        extra_path.mkdir()

    with pytest.raises(SnapshotIntegrityError, match="root"):
        verify_snapshot(destination / "manifest.json")


def test_snapshot_rejects_page_count_mismatch_after_pdf_digest_is_rebound(tmp_path: Path) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    manifest_path = destination / "manifest.json"
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    first_pdf = next(iter(payload["pdfs"]))
    (destination / "pdfs" / first_pdf).write_bytes((destination / "pdfs" / first_pdf).read_bytes())
    payload["page_count"] = 11
    _rewrite_manifest(manifest_path, payload)

    with pytest.raises(SnapshotIntegrityError, match="page"):
        verify_snapshot(manifest_path)


def test_snapshot_rejects_a_plausible_bbox_shift_that_matches_provenance(tmp_path: Path) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    database = destination / "records.sqlite3"
    connection = sqlite3.connect(database)
    source = json.loads(
        connection.execute(
            "SELECT source_json FROM records WHERE synthetic_id = ?", ("SYN-KA-A",)
        ).fetchone()[0]
    )
    source["record_bbox"] = [0, 1, 900, 431]
    provenance = json.loads(
        connection.execute(
            "SELECT field_provenance FROM records WHERE synthetic_id = ?", ("SYN-KA-A",)
        ).fetchone()[0]
    )
    for field in provenance.values():
        field["source"]["record_bbox"] = source["record_bbox"]
    connection.execute(
        "UPDATE records SET source_json = ?, field_provenance = ? WHERE synthetic_id = ?",
        (json.dumps(source), json.dumps(provenance), "SYN-KA-A"),
    )
    connection.commit()
    connection.close()
    _refresh_database_digest(destination)

    with pytest.raises(SnapshotIntegrityError, match="geometry"):
        verify_snapshot(destination / "manifest.json")


def test_snapshot_rejects_evidence_with_a_rebound_digest_but_wrong_dimensions(
    tmp_path: Path,
) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    evidence_id = "evidence-SYN-KA-A"
    evidence_path = destination / "evidence" / f"{evidence_id}.png"
    Image.new("RGB", (1, 1), "white").save(evidence_path)
    evidence_digest = sha256_path(evidence_path)
    database = destination / "records.sqlite3"
    connection = sqlite3.connect(database)
    source = json.loads(
        connection.execute(
            "SELECT source_json FROM records WHERE synthetic_id = ?", ("SYN-KA-A",)
        ).fetchone()[0]
    )
    source["evidence_sha256"] = evidence_digest
    provenance = json.loads(
        connection.execute(
            "SELECT field_provenance FROM records WHERE synthetic_id = ?", ("SYN-KA-A",)
        ).fetchone()[0]
    )
    for field in provenance.values():
        field["source"]["evidence_sha256"] = evidence_digest
        field["crop_sha256"] = evidence_digest
    connection.execute(
        "UPDATE records SET source_json = ?, field_provenance = ? WHERE synthetic_id = ?",
        (json.dumps(source), json.dumps(provenance), "SYN-KA-A"),
    )
    connection.commit()
    connection.close()
    manifest_path = destination / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["evidence"][evidence_id] = evidence_digest
    _rewrite_manifest(manifest_path, manifest)
    _refresh_database_digest(destination)

    with pytest.raises(SnapshotIntegrityError, match="geometry"):
        verify_snapshot(manifest_path)


def test_snapshot_rejects_same_sized_evidence_cards_swapped_with_rebound_digests(
    tmp_path: Path,
) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    first_id = "SYN-KA-A"
    second_id = "SYN-KA-B"
    first_path = destination / "evidence" / f"evidence-{first_id}.png"
    second_path = destination / "evidence" / f"evidence-{second_id}.png"
    first_bytes = first_path.read_bytes()
    second_bytes = second_path.read_bytes()
    first_path.write_bytes(second_bytes)
    second_path.write_bytes(first_bytes)
    first_digest = sha256_path(first_path)
    second_digest = sha256_path(second_path)
    database = destination / "records.sqlite3"
    connection = sqlite3.connect(database)
    _replace_record_source_evidence_digest(connection, first_id, first_digest)
    _replace_record_source_evidence_digest(connection, second_id, second_digest)
    connection.commit()
    connection.close()
    manifest_path = destination / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["evidence"][f"evidence-{first_id}"] = first_digest
    manifest["evidence"][f"evidence-{second_id}"] = second_digest
    _rewrite_manifest(manifest_path, manifest)
    _refresh_database_digest(destination)

    with pytest.raises(SnapshotIntegrityError, match="pixel"):
        verify_snapshot(manifest_path)


def test_fresh_demo_renders_and_snapshots_have_identical_hashes(tmp_path: Path) -> None:
    first_source = render_demo_source(tmp_path / "first-source")
    second_source = render_demo_source(tmp_path / "second-source")

    assert [sha256_path(path) for path in first_source.manifest.pdf_paths] == [
        sha256_path(path) for path in second_source.manifest.pdf_paths
    ]

    first_destination = tmp_path / "first-snapshot"
    second_destination = tmp_path / "second-snapshot"
    build_demo_snapshot(first_source, first_destination)
    build_demo_snapshot(second_source, second_destination)
    relative_paths = (
        Path("manifest.json"),
        Path("records.sqlite3"),
        *(Path("pdfs") / path.name for path in sorted(first_source.manifest.pdf_paths)),
    )
    assert {path: sha256_path(first_destination / path) for path in relative_paths} == {
        path: sha256_path(second_destination / path) for path in relative_paths
    }


@pytest.mark.parametrize(
    ("column", "mutate"),
    [
        ("source_json", lambda payload: {"evidence_id": "evidence-SYN-KA-A"}),
        (
            "field_provenance",
            lambda payload: {key: value for key, value in payload.items() if key != "relationship"},
        ),
        (
            "field_provenance",
            lambda payload: {**payload, "bogus": next(iter(payload.values()))},
        ),
        (
            "field_provenance",
            lambda payload: {
                **payload,
                "name": {
                    **payload["name"],
                    "source": {
                        **payload["name"]["source"],
                        "evidence_id": "evidence-SYN-KA-B",
                    },
                },
            },
        ),
        (
            "field_provenance",
            lambda payload: {
                **payload,
                "name": {**payload["name"], "crop_sha256": "0" * 64},
            },
        ),
        (
            "source_json",
            lambda payload: {**payload, "evidence_sha256": "0" * 64},
        ),
        (
            "source_json",
            lambda payload: {**payload, "pdf_id": "synthetic-karnataka-demo-2.pdf"},
        ),
        ("source_json", lambda payload: {**payload, "page_number": 5}),
        ("source_json", lambda payload: {**payload, "record_bbox": [-1, 0, 900, 430]}),
    ],
)
def test_snapshot_rejects_invalid_source_or_field_provenance(
    tmp_path: Path, column: str, mutate: object
) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    database = destination / "records.sqlite3"
    connection = sqlite3.connect(database)
    payload = json.loads(
        connection.execute(
            f"SELECT {column} FROM records WHERE synthetic_id = ?", ("SYN-KA-A",)
        ).fetchone()[0]
    )
    connection.execute(
        f"UPDATE records SET {column} = ? WHERE synthetic_id = ?",
        (json.dumps(mutate(payload)), "SYN-KA-A"),  # type: ignore[operator]
    )
    connection.commit()
    connection.close()
    _refresh_database_digest(destination)

    with pytest.raises(SnapshotIntegrityError):
        verify_snapshot(destination / "manifest.json")


@pytest.mark.parametrize(
    ("example_index", "key", "value"),
    [
        (0, "label", "Different label"),
        (1, "query", {"name": "Ananya Gowda"}),
        (2, "expected_state", "possible_match"),
        (3, "expected_record_id", "SYN-KA-MISSING"),
    ],
)
def test_snapshot_rejects_mutated_reviewer_example(
    tmp_path: Path, example_index: int, key: str, value: object
) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    manifest_path = destination / "manifest.json"
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["demo_examples"][example_index][key] = value
    _rewrite_manifest(manifest_path, payload)

    with pytest.raises(SnapshotIntegrityError, match="example"):
        verify_snapshot(manifest_path)


def test_builder_keeps_the_final_destination_absent_after_a_staging_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    destination = tmp_path / "snapshot"
    corpus = render_demo_source(tmp_path / "source")
    original_create_database = builder._create_database

    def fail_database(*args: object, **kwargs: object) -> None:
        raise RuntimeError("planned staging failure")

    monkeypatch.setattr(builder, "_create_database", fail_database)
    with pytest.raises(RuntimeError, match="planned staging failure"):
        build_demo_snapshot(corpus, destination)
    assert not destination.exists()

    monkeypatch.setattr(builder, "_create_database", original_create_database)
    assert build_demo_snapshot(corpus, destination).record_count == 120


def test_builder_rejects_an_invalid_evidence_id_before_publication(tmp_path: Path) -> None:
    destination = tmp_path / "snapshot"
    corpus = render_demo_source(tmp_path / "source")
    corpus.records[0].truth.source.evidence_id = "../outside"

    with pytest.raises(SnapshotIntegrityError, match="evidence"):
        build_demo_snapshot(corpus, destination)
    assert not destination.exists()


@pytest.mark.parametrize(
    "statement",
    [
        "DELETE FROM records_fts",
        """
        INSERT INTO records_fts(
            rowid, name_native, name_latin, relative_name_native, relative_name_latin,
            locality_native, locality_latin
        ) VALUES (999, 'bogus', 'bogus', 'bogus', 'bogus', 'bogus', 'bogus')
        """,
    ],
)
def test_snapshot_rejects_empty_or_corrupted_fts_content(tmp_path: Path, statement: str) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    database = destination / "records.sqlite3"
    connection = sqlite3.connect(database)
    connection.execute(statement)
    connection.commit()
    connection.close()
    _refresh_database_digest(destination)

    with pytest.raises(SnapshotIntegrityError, match="FTS content"):
        verify_snapshot(destination / "manifest.json")


def test_snapshot_rejects_a_rebound_noncanonical_snapshot_identifier(tmp_path: Path) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    database = destination / "records.sqlite3"
    connection = sqlite3.connect(database)
    source = json.loads(
        connection.execute(
            "SELECT source_json FROM records WHERE synthetic_id = ?", ("SYN-KA-A",)
        ).fetchone()[0]
    )
    source["snapshot_id"] = "synthetic-karnataka-other-v1"
    provenance = json.loads(
        connection.execute(
            "SELECT field_provenance FROM records WHERE synthetic_id = ?", ("SYN-KA-A",)
        ).fetchone()[0]
    )
    for field in provenance.values():
        field["source"]["snapshot_id"] = source["snapshot_id"]
    connection.execute(
        "UPDATE records SET source_json = ?, field_provenance = ? WHERE synthetic_id = ?",
        (json.dumps(source), json.dumps(provenance), "SYN-KA-A"),
    )
    connection.commit()
    connection.close()
    _refresh_database_digest(destination)

    with pytest.raises(SnapshotIntegrityError, match="snapshot"):
        verify_snapshot(destination / "manifest.json")


@pytest.mark.parametrize(
    "statement",
    [
        "DROP TABLE records_fts",
        "ALTER TABLE records ADD COLUMN unexpected TEXT",
    ],
)
def test_snapshot_rejects_a_missing_fts_table_or_changed_required_schema(
    tmp_path: Path, statement: str
) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    database = destination / "records.sqlite3"
    connection = sqlite3.connect(database)
    connection.execute(statement)
    connection.commit()
    connection.close()
    _refresh_database_digest(destination)

    with pytest.raises(SnapshotIntegrityError, match="schema"):
        verify_snapshot(destination / "manifest.json")
