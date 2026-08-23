import json
import sqlite3
from pathlib import Path

from record_finder.index.builder import build_demo_snapshot
from record_finder.index.manifest import verify_snapshot
from record_finder.synthetic.render import render_demo_source


def test_demo_snapshot_has_complete_pdf_crop_and_database_accounting(tmp_path: Path) -> None:
    destination = tmp_path / "snapshot"
    manifest = build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    verified = verify_snapshot(destination / "manifest.json")

    assert verified == manifest
    assert len(verified.record_ids) == len(set(verified.record_ids)) == 120
    assert tuple(verified.record_ids[:3]) == ("SYN-KA-A", "SYN-KA-B", "SYN-KA-C")
    assert (destination / "records.sqlite3").is_file()
    assert len(list((destination / "pdfs").glob("*.pdf"))) == 3


def test_demo_examples_are_bound_to_the_catalogue_truth(tmp_path: Path) -> None:
    manifest = build_demo_snapshot(render_demo_source(tmp_path / "source"), tmp_path / "snapshot")
    examples = {example.id: example for example in manifest.demo_examples}

    assert examples["exact-kannada"].expected_record_id == "SYN-KA-A"
    assert examples["romanized-typo"].query["name"] == "Ananya Gowdaa"
    assert examples["needs-refinement"].expected_record_id == "SYN-KA-C"
    assert examples["needs-refinement"].refinement == {
        "relative_name": "Sunil Nayak",
        "locality": "Beluru",
        "age": 31,
    }
    assert examples["no-confident-match"].expected_record_id is None


def test_every_displayed_record_field_has_synthetic_ground_truth_provenance(
    tmp_path: Path,
) -> None:
    destination = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), destination)
    connection = sqlite3.connect(destination / "records.sqlite3")
    provenance_payload = connection.execute(
        "SELECT field_provenance FROM records WHERE synthetic_id = ?", ("SYN-KA-A",)
    ).fetchone()[0]
    connection.close()
    provenance = json.loads(provenance_payload)

    assert set(provenance) == {
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
    assert {entry["origin"] for entry in provenance.values()} == {"synthetic_ground_truth"}
