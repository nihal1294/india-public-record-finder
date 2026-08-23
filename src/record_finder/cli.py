"""Offline commands for the synthetic record-finder build."""

import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import typer
from PIL import Image, ImageDraw

from record_finder.index.builder import build_demo_snapshot
from record_finder.index.manifest import verify_snapshot
from record_finder.ocr.base import OCRReport, evaluate_ocr
from record_finder.ocr.subprocess import SubprocessOCRProvider, build_crop_allowlist
from record_finder.search.dense import LocalE5Encoder
from record_finder.search.service import (
    SearchService,
    benchmark_gate_result,
    run_benchmark,
)
from record_finder.synthetic.catalog import CATALOG
from record_finder.synthetic.render import render_demo_source, render_spike

app = typer.Typer(add_completion=False, invoke_without_command=True)


@app.callback()
def main() -> None:
    """Offline commands for synthetic source generation and validation."""


def _contact_sheet(evidence_paths: list[Path], destination: Path) -> None:
    cards = [Image.open(path).convert("RGB") for path in evidence_paths]
    width = 2 * 900
    height = 5 * 430
    sheet = Image.new("RGB", (width, height), "white")
    for index, card in enumerate(cards):
        x = (index % 2) * 900
        y = (index // 2) * 430
        sheet.paste(card, (x, y))
        ImageDraw.Draw(sheet).rectangle((x, y, x + 899, y + 429), outline="black", width=2)
    sheet.save(destination)


def _report_payload(report: OCRReport, output: Path) -> dict[str, object]:
    return {
        "schema_version": 1,
        "data_classification": "synthetic",
        "record_count": report.record_count,
        "page_count": report.page_count,
        "semantic_exact": report.semantic_exact,
        "semantic_total": report.semantic_total,
        "semantic_accuracy": report.semantic_accuracy,
        "gate_passed": report.gate_passed,
        "mismatches": [
            {
                "synthetic_id": mismatch.synthetic_id,
                "field": mismatch.field,
                "expected": mismatch.expected,
                "actual": mismatch.actual,
                "crop_path": str(mismatch.crop_path.relative_to(output)),
            }
            for mismatch in report.mismatches
        ],
        "records": [
            {
                "synthetic_id": record.synthetic_id,
                "source": record.source.model_dump(mode="json"),
                "extractions": {
                    field: extraction.model_dump(mode="json")
                    for field, extraction in record.extractions.items()
                },
            }
            for record in report.records
        ],
    }


@app.command("ocr-spike")
def ocr_spike(
    output: Path = typer.Option(..., file_okay=False),
    records: int = typer.Option(10, min=10, max=10),
    timeout_seconds: float = typer.Option(30.0, min=1.0, max=120.0),
) -> None:
    """Render and OCR exactly ten deterministic fictional Karnataka records."""
    if records != 10:
        raise typer.BadParameter("the feasibility corpus is fixed at 10 records")
    corpus = render_spike(output)
    report = evaluate_ocr(
        corpus,
        SubprocessOCRProvider(
            allowed_crops=build_crop_allowlist(corpus), timeout_seconds=timeout_seconds
        ),
    )
    _contact_sheet(
        [record.evidence_crop for record in corpus.records], output / "evidence-contact-sheet.png"
    )
    (output / "ocr-report.json").write_text(
        json.dumps(_report_payload(report, output), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if not report.gate_passed:
        raise typer.Exit(code=1)


@app.command("build-snapshot")
def build_snapshot(
    destination: Path = typer.Option(..., file_okay=False),
    model_cache: Path | None = typer.Option(None, file_okay=False),
) -> None:
    """Build the deterministic fictional 120-record demo snapshot."""
    encoder = (
        LocalE5Encoder(model_cache / "multilingual-e5-small", Path("models/manifest.json"))
        if model_cache is not None
        else None
    )
    with TemporaryDirectory(prefix="record-finder-demo-source-") as temporary_root:
        manifest = build_demo_snapshot(
            render_demo_source(Path(temporary_root)), destination, dense_encoder=encoder
        )
    typer.echo(f"built {manifest.record_count} synthetic records at {destination}")


@app.command("verify-snapshot")
def verify_snapshot_command(manifest_path: Path) -> None:
    """Verify every declared database, PDF, and evidence digest."""
    manifest = verify_snapshot(manifest_path)
    typer.echo(f"verified {manifest.record_count} synthetic records")


@app.command("serve")
def serve(
    snapshot: Path = typer.Option(..., file_okay=True),
    model_cache: Path = typer.Option(..., file_okay=False),
    model_manifest: Path = typer.Option(..., file_okay=True),
    host: str = typer.Option("127.0.0.1"),
    port: int = typer.Option(8765, min=1, max=65535),
    web_root: Path | None = typer.Option(None, file_okay=False),
) -> None:
    """Serve only the verified snapshot, local model, API, and optional browser assets."""
    import uvicorn

    from record_finder.api.app import create_app

    uvicorn.run(
        create_app(
            snapshot,
            web_root=web_root,
            model_cache=model_cache,
            model_manifest_path=model_manifest,
        ),
        host=host,
        port=port,
        access_log=False,
        proxy_headers=False,
    )


def _exact_query(entry: object, native: bool) -> dict[str, str | int]:
    relative_field = "relative_name_native" if native else "relative_name_latin"
    return {
        "name": getattr(entry, "name_native" if native else "name_latin"),
        "relative_name": getattr(entry, relative_field),
        "locality": getattr(entry, "locality_native" if native else "locality_latin"),
        "age": getattr(entry, "age"),
    }


def _informal_romanization(value: str) -> str:
    result = value.casefold()
    for source, replacement in (("aa", "a"), ("ee", "i"), ("oo", "u"), ("th", "t"), ("sh", "s")):
        result = result.replace(source, replacement)
    return result


def _ocr_like_typo(value: str) -> str:
    for source, replacement in (("m", "rn"), ("l", "1"), ("o", "0"), ("i", "l"), ("e", "c")):
        if source in value.casefold():
            return value.casefold().replace(source, replacement, 1)
    return value.casefold() + "x"


@app.command("generate-benchmark")
def generate_benchmark(
    snapshot: Path = typer.Option(..., file_okay=True),
    destination: Path = typer.Option(..., file_okay=True),
) -> None:
    """Generate the fixed 180-query synthetic evidence set bound to one snapshot."""
    verify_snapshot(snapshot)
    entries = list(CATALOG)
    duplicates = [
        entry
        for entry in entries
        if sum(other.name_latin == entry.name_latin for other in entries) > 1
    ]
    if len(entries) != 120 or len(duplicates) < 30:
        raise RuntimeError("the fixed synthetic catalog cannot produce the benchmark")
    queries: list[dict[str, object]] = []
    for entry in entries[:30]:
        queries.append(
            {
                "id": f"exact-kannada-{entry.synthetic_id}",
                "slice": "exact_kannada",
                "query": _exact_query(entry, native=True),
                "expected_record_id": entry.synthetic_id,
            }
        )
    for entry in entries[30:60]:
        queries.append(
            {
                "id": f"exact-latin-{entry.synthetic_id}",
                "slice": "exact_latin",
                "query": _exact_query(entry, native=False),
                "expected_record_id": entry.synthetic_id,
            }
        )
    for entry in entries[60:90]:
        queries.append(
            {
                "id": f"romanization-{entry.synthetic_id}",
                "slice": "romanization",
                "query": {"name": _informal_romanization(entry.name_latin)},
                "expected_record_id": entry.synthetic_id,
            }
        )
    for entry in entries[90:120]:
        queries.append(
            {
                "id": f"typo-ocr-{entry.synthetic_id}",
                "slice": "typo_ocr",
                "query": {"name": _ocr_like_typo(entry.name_latin)},
                "expected_record_id": entry.synthetic_id,
            }
        )
    for entry in duplicates[:30]:
        queries.append(
            {
                "id": f"common-name-refinement-{entry.synthetic_id}",
                "slice": "common_name_refinement",
                "query": _exact_query(entry, native=False),
                "expected_record_id": entry.synthetic_id,
            }
        )
    for index in range(30):
        queries.append(
            {
                "id": f"no-match-near-miss-{index + 1:02d}",
                "slice": "no_match_near_miss",
                "query": {
                    "name": f"Nandini Meridian {index + 1:02d}",
                    "locality": "Imaginary Nagar",
                },
            }
        )
    if len(queries) != 180:
        raise RuntimeError("benchmark query accounting failed")
    payload = {
        "schema_version": 1,
        "data_classification": "synthetic",
        "record_origin": "synthetic_ground_truth",
        "snapshot_manifest_sha256": hashlib.sha256(snapshot.read_bytes()).hexdigest(),
        "queries": queries,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    typer.echo(f"generated {len(queries)} synthetic benchmark queries at {destination}")


@app.command("benchmark")
def benchmark(
    snapshot: Path = typer.Option(..., file_okay=True),
    queries: Path = typer.Option(..., file_okay=True),
    report: Path = typer.Option(..., file_okay=True),
    model_cache: Path = typer.Option(..., file_okay=False),
) -> None:
    """Run the fixed synthetic benchmark using the manifest-pinned local encoder."""
    encoder = LocalE5Encoder(model_cache / "multilingual-e5-small", Path("models/manifest.json"))
    service = SearchService(snapshot, encoder=encoder)
    try:
        benchmark_report = run_benchmark(service, queries)
    finally:
        service.close()
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(benchmark_report.model_dump(), indent=2) + "\n", encoding="utf-8")
    typer.echo(
        f"benchmark: {benchmark_report.query_count} queries, "
        f"Recall@5={benchmark_report.overall_recall_at_5:.3f}, "
        f"p95={benchmark_report.latency_p95_ms:.1f}ms"
    )
    gate = benchmark_gate_result(benchmark_report)
    typer.echo(f"benchmark gate path: {gate.path}")
    if gate.errors:
        for error in gate.errors:
            typer.echo(f"gate failed: {error}", err=True)
        raise typer.Exit(code=1)
